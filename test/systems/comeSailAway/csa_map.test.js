// CSA-I (2026-09-27) - COME SAIL AWAY'S POSITION READING AND THE WATER WALK: the position box and its coroutine
// (ComeSailAway.cs 5525-5541, 5589-5780), OnGUI's map and debug values (4089-4182, systems/comeSailAway/comeSailAwayMap.js), and
// LateUpdate's water walk (4963-4982, 5044-5051; StartWaterwalking / EndWaterwalking 5966-6029) - over the real
// SpawnBoat and the vendored models, every host door scripted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../../../src/systems/comeSailAway/comeSailAwayModels.js';
import { spawnBoat, TRIGGER_MODEL } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, BOAT_EFFECT_BUNDLE, WATER_WALKING_SILENT, boundsContains } from '../../../src/systems/comeSailAway/comeSailAway.js';
import {
  travelMapPicture, mapRect, guiMouse, mapPixelUnder, guiRectContains, vector2IntDistance, dayOfMonthWithSuffix, markerLabel,
  csFloatString, mapOverlayDraws, MAP_MARKER_MODE_COLORS, MAP_MARKER_MODE_LABELS, MAP_HELP_LINES, DAGGERFALL_DEFAULT_TEXT_COLOR,
  COLOR_BLACK, COLOR_RED, LINE_TEXTURE,
} from '../../../src/systems/comeSailAway/comeSailAwayMap.js';
import { REGION_PANEL_OFFSET } from '../../../src/ui/travel/travelMapWindow.js';
import { isEntityWaterWalking, assignModBundle, removeBundleNamed, WATER_WALKING_SILENT_KIND, hasActiveEffect, tickActiveEffects } from '../../../src/systems/effects.js';
import { liveBundles } from '../../../src/systems/mysticism.js';

const DIR = new URL('../../../vendor/come-sail-away/Models/', import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const f = Math.fround;
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }), particleRandom: () => 0.5 });
const src = (p) => readFileSync(new URL(`../../../src/${p}`, import.meta.url), 'utf8');
const SCREEN = { x: 0, y: 0, width: 1920, height: 1080 };

function terrain(x, y) {
  return { mapPixelX: x, mapPixelY: y, position: [(x - 10) * 819.2, 0, -(y - 20) * 819.2], tileMap: new Uint8Array(128 * 128), sampleHeight: () => 20 };
}

/** A scripted scene: the boxes, the pause, the frame's keys and the mouse, the effect manager - each a door. */
function scene(opts = {}) {
  const out = { boxes: [], opens: 0, closes: 0, log: [], assigned: [], removed: [] };
  const terrains = [terrain(10, 20)];
  const world = {
    time: 0, hour: 12, weather: 0, box: false, paused: false, pixel: { X: 207, Y: 213 }, mouse: [0, 0],
    down: new Set(), up: new Set(), held: new Set(), player: [1, 2, 3], ipnm: false, walking: false, bundles: [],
    date: { day: 4, month: 0 },
  };
  const settings = { 'Waves.Enable': false, ...opts.settings };
  const deps = {
    pool: { models: MODELS, ready: () => true, spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); return boat; }, remove: () => {} },
    player: () => ({ position: [...world.player], rotation: [0, 0, 0, 1] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ ...world.pixel }),
    isPlayerInside: () => false, blockWaterLevel: () => NO_WATER_LEVEL, iliacPuddleNoMore: () => world.ipnm,
    raycast: () => null, playerTerrain: () => terrains[0], terrainAt: () => terrains[0], terrains: () => terrains,
    heightMapValue: () => 255, worldCompensation: () => [0, 0, 0],
    hudText: () => {}, midScreenText: () => {}, log: (t) => out.log.push(t),
    random: { range: (min) => min, rangeFloat: (min) => min },
    time: () => world.time, hour: () => world.hour, weatherType: () => world.weather, dt: () => 0.25,
    persistentDungeonBoats: () => false, packedItems: { serialize: (i) => i, deserialize: (r) => r },
    setting: (k) => settings[k],
    input: {
      has: () => false, started: () => false, horizontal: () => 0, vertical: () => 0, toggleAutorun: false,
      keyDown: (k) => world.down.has(k), keyUp: (k) => world.up.has(k), key: (k) => world.held.has(k),
    },
    helm: { setPlayerPosition: () => {}, setFacing: () => {}, turnPlayer: () => {}, freeze: () => {}, frozen: () => false, stopRunning: () => {}, footsteps: () => {}, alignToGround: () => {} },
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false, isOnShip: () => false },
    ship: { owns: () => true, assign: () => {}, removePermanentScene: () => {} },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue: () => {} },
    cargoWeight: () => 0, sphereCastAll: () => [], enemies: () => [],
    enemiesNearby: () => false, travelOptionsActive: () => null, timeScale: () => 1, setTimeScale: () => {}, soundVolume: () => 1,
    audio: { play: () => {}, stop: () => {}, oneShot: () => {}, dfOneShot: () => {}, dfClipAtPoint: () => {}, uiOneShot: () => {} },
    // CSA-I
    messageBox: (t) => { out.boxes.push(t); world.box = true; },
    topWindowIsMessageBox: () => world.box,
    gamePaused: () => world.paused || world.box,
    map: { open: () => { out.opens++; world.paused = true; }, close: () => { out.closes++; world.paused = false; } },
    mousePosition: () => [...world.mouse],
    screenRect: () => ({ ...SCREEN }),
    date: () => ({ ...world.date }),
    effects: opts.noEffects ? null : {
      isWaterWalking: () => world.walking,
      bundleNames: () => [...world.bundles],
      assignBundle: (spec) => { out.assigned.push(spec); world.bundles.push(spec.name); world.walking = true; },
      removeBundle: (name) => { out.removed.push(name); world.bundles.splice(world.bundles.indexOf(name), 1); world.walking = world.bundles.length > 0; },
    },
  };
  const rt = createComeSailAwayRuntime(deps);
  const place = (hull = 2, variant = 0, at = [100, 34, 200]) => rt.PlaceBoat(at, [0, 0, 1], hull, variant, terrains[0]);
  /** One frame's end with these keys down (and up), cleared after. */
  const frame = ({ down = [], up = [] } = {}) => { for (const k of down) world.down.add(k); for (const k of up) world.up.add(k); rt.endOfFrame(); world.down.clear(); world.up.clear(); };
  /** The mouse on a GUI pixel (y down), handed over as Unity's (y up). */
  const mouseAtGui = (x, y) => { world.mouse = [x, SCREEN.height - y]; };
  return { rt, out, world, place, frame, mouseAtGui, settings };
}

// ── the picture and the arithmetic (systems/comeSailAway/comeSailAwayMap.js) ─────────────────────────────────────────────────

test('CSA-I: record 3 rebuilt - TRAV0I00.IMG\'s interior from row 12, nearest at each texel\'s centre, 1000x500, opaque and top down; lineTexture is TEXTURE.000\'s solid record 112', () => {
  const bitmap = { width: 320, height: 200, data: new Uint8Array(320 * 200) };
  for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) bitmap.data[y * 320 + x] = (x + 3 * y) % 256;
  const colorOf = (i) => ({ r: i, g: 255 - i, b: (i * 7) % 256 });
  const pic = travelMapPicture(bitmap, colorOf);
  assert.deepEqual([pic.width, pic.height, pic.data.length], [1000, 500, 1000 * 500 * 4]);
  const at = (x, y) => [...pic.data.slice((y * 1000 + x) * 4, (y * 1000 + x) * 4 + 4)];
  const expect = (x, y) => {
    const sx = Math.min(319, Math.round((x + 0.5) * 320 / 1000 - 0.5)), sy = Math.min(159, Math.round((y + 0.5) * 160 / 500 - 0.5));
    const c = colorOf(bitmap.data[(sy + REGION_PANEL_OFFSET) * 320 + sx]);
    return [c.r, c.g, c.b, 255];
  };
  for (const [x, y] of [[0, 0], [1, 1], [2, 3], [3, 4], [6, 7], [500, 250], [999, 499], [998, 12], [313, 77]]) assert.deepEqual(at(x, y), expect(x, y), `texel ${x},${y}`);
  assert.notDeepEqual(at(3, 1), [...(() => { const c = colorOf(bitmap.data[(0 + REGION_PANEL_OFFSET) * 320 + 0]); return [c.r, c.g, c.b, 255]; })()], 'texel 3 is the IMG\'s column 1 (its centre, 1.12 - 0.5, rounds up), not the 0 a floor gives');
  assert.deepEqual(at(0, 0).slice(0, 3), [36, 219, 252], 'row 12 of the IMG under the first texel (index 36), not row 0');
  assert.deepEqual(LINE_TEXTURE, { archive: 0, record: 112, frame: 0 });
});

test('CSA-I: the map\'s rect, the mouse and its pixel - the width scaled twice before it is halved (a scaled screen pushes the map off it, kept); Rect.Contains takes the min edges only; the pixel is the screen\'s offset off the corner', () => {
  assert.deepEqual(mapRect(SCREEN, [1, 1]), { x: 460, y: 290, w: 1000, h: 500 });
  const scaled = mapRect(SCREEN, [f(1080 / 200), f(1080 / 200)]);
  assert.ok(scaled.x >= SCREEN.width, `ScalingMode 1 at 1920x1080 starts the map at ${scaled.x}: off the screen (kept)`);
  assert.deepEqual(mapRect({ x: 10, y: 20, width: 320, height: 200 }, [1, 1]), { x: -330, y: -130, w: 1000, h: 500 });
  const r = mapRect(SCREEN, [1, 1]);
  assert.deepEqual(guiMouse(SCREEN, [560, 740]), [560, 340], 'y from the bottom, turned down');
  assert.deepEqual(mapPixelUnder(r, [560.5, 340.5]), [100, 50], 'RoundToInt: the half to the even');
  assert.deepEqual(mapPixelUnder(r, [561.5, 341.5]), [102, 52]);
  assert.equal(guiRectContains(r, [460, 290]), true, 'the min corner is in');
  assert.equal(guiRectContains(r, [1460, 500]), false, 'the max edge is out');
  assert.equal(guiRectContains(r, [1459.9, 789.9]), true);
  assert.equal(vector2IntDistance([0, 0], [3, 4]), 5);
  const box = { center: [0, 2, 0], extent: [1, 1, 3] };
  assert.deepEqual([[1, 2, 0], [-1, 1, -3], [0, 3, 3], [f(1.0001), 2, 0], [0, 0.99, 0]].map((p) => boundsContains(box, p)), [true, true, true, false, false], 'Bounds.Contains: the faces in');
});

test('CSA-I: the marker colours are Unity\'s constants, their labels the mod\'s; a label is "(x, y) - 5th of Morning Star"; Single.ToString() is G7', () => {
  assert.deepEqual(MAP_MARKER_MODE_LABELS, ['Yellow', 'Green', 'Cyan', 'Blue', 'Magenta', 'Red', 'White', 'Gray']);
  assert.deepEqual(MAP_MARKER_MODE_COLORS.map((c) => [c.r, c.g, c.b, c.a]), [
    [1, f(0.92156863), f(0.015686275), 1], [0, 1, 0, 1], [0, 1, 1, 1], [0, 0, 1, 1], [1, 0, 1, 1], [1, 0, 0, 1], [1, 1, 1, 1], [0.5, 0.5, 0.5, 1]]);
  assert.deepEqual([0, 1, 2, 3, 4, 20, 21, 22, 23, 29].map(dayOfMonthWithSuffix), ['1st', '2nd', '3rd', '4th', '5th', '21st', '22nd', '23rd', '24th', '30th']);
  assert.equal(markerLabel([100, 50], '5th', 'Morning Star'), '(100, 50) - 5th of Morning Star');
  assert.deepEqual([3.14159265, 0.1, 12345678, 0.00001234, 0.0001, 0.000001, 100, 1 / 3, -0.5, 9999999, 1e7, 0].map(csFloatString),
    ['3.141593', '0.1', '1.234568E+07', '1.234E-05', '0.0001', '1E-06', '100', '0.3333333', '-0.5', '9999999', '1E+07', '0']);
});

test('CSA-I: OnGUI\'s map in its order - the backdrop over the screen, the picture, the blinking cross, the six lines, each marker (its outline first), then the labels near the mouse; the tints and the Left Shift thicknesses', () => {
  const base = {
    screenRect: SCREEN, screen: [1920, 1080], scale: [1, 1], mouse: [562, 342], unscaledTime: 0.1, showingPosition: true, pixel: [207, 213],
    markers: [{ position: [100, 50], label: 'a', color: { ...MAP_MARKER_MODE_COLORS[5] } }, { position: [300, 60], label: 'b', color: { ...MAP_MARKER_MODE_COLORS[1] } }],
    markerMode: 2, opacity: 0.5, lineThickness: 2, markerThickness: 2, outlineThickness: 2, markerThicknessRaw: 2, clickRange: 5,
  };
  const d = mapOverlayDraws(base);
  assert.deepEqual(d.map((x) => (x.kind === 'quad' ? `q:${x.tex}` : `t:${x.text}`)), [
    'q:line', 'q:map', 'q:line', 'q:line', ...MAP_HELP_LINES.map((l) => `t:${l}`), 't:Current marker color is Cyan',
    'q:line', 'q:line', 'q:line', 'q:line', 't:a']);
  assert.deepEqual([d[0].rect, d[0].color], [{ x: 0, y: 0, w: 1920, h: 1080 }, { ...COLOR_BLACK, a: 0.5 }], 'the backdrop: black at the opacity');
  assert.deepEqual(d[1].rect, { x: 460, y: 290, w: 1000, h: 500 });
  assert.deepEqual([d[2].rect, d[3].rect, d[2].color], [{ x: 460 + 207 - 2, y: 290, w: 5, h: 500 }, { x: 460, y: 290 + 213 - 2, w: 1000, h: 5 }, COLOR_RED], 'the cross on the player\'s pixel');
  const texts = d.filter((x) => x.kind === 'text');
  assert.deepEqual(texts.slice(0, 6).map((t) => [t.x, t.y, t.scale]), [[0, 0, 3], [0, 20, 3], [0, 40, 3], [0, 60, 3], [0, 80, 3], [0, 1060, 3]]);
  assert.deepEqual([texts[0].color, texts[0].shadow, texts[0].shadowPos], [DAGGERFALL_DEFAULT_TEXT_COLOR, COLOR_BLACK, [3, 3]]);
  const m = d.filter((x) => x.kind === 'quad').slice(4);
  assert.deepEqual(m.map((q) => q.rect), [
    { x: 460 + 100 - 2 - 2, y: 290 - 2 + 50 - 2, w: 9, h: 9 }, { x: 460 + 100 - 2, y: 290 - 2 + 50, w: 5, h: 5 },
    { x: 460 + 300 - 4, y: 290 + 60 - 4, w: 9, h: 9 }, { x: 460 + 300 - 2, y: 290 - 2 + 60, w: 5, h: 5 }]);
  assert.deepEqual([m[0].color, m[1].color], [COLOR_BLACK, MAP_MARKER_MODE_COLORS[5]]);
  assert.deepEqual([texts[6].x, texts[6].y], [460 + 100 - 2 + 10, 290 - 2 + 50 - 20], 'the label right 10 and up 20 of the marker');
  // the cross blinks with Sin(unscaledTime x 5)
  assert.equal(mapOverlayDraws({ ...base, unscaledTime: 0.7 }).filter((x) => x.kind === 'quad').length, 1 + 1 + 4, 'Sin(3.5) < 0: no cross');
  assert.equal(mapOverlayDraws({ ...base, showingPosition: false }).filter((x) => x.kind === 'quad').length, 6, 'no reading: no cross');
  // Left Shift zeroes the three Final thicknesses - the outline gone - and the label keeps the raw one (kept)
  const shift = mapOverlayDraws({ ...base, lineThickness: 0, markerThickness: 0, outlineThickness: 0 });
  const sq = shift.filter((x) => x.kind === 'quad');
  assert.deepEqual([sq.length, sq[2].rect.w, sq[4].rect], [2 + 2 + 2, 1, { x: 560, y: 340, w: 1, h: 1 }]);
  const st = shift.filter((x) => x.kind === 'text').at(-1);
  assert.deepEqual([st.text, st.x, st.y], ['a', 460 + 100 - 2 + 10, 290 - 2 + 50 - 20]);
  // a label only within the click range of the pixel under the mouse
  assert.equal(mapOverlayDraws({ ...base, mouse: [462 + 300, 290 + 60] }).filter((x) => x.kind === 'text').at(-1).text, 'b');
  assert.equal(mapOverlayDraws({ ...base, mouse: [560 + 6, 340] }).filter((x) => x.kind === 'text').length, 6, 'six pixels off: no label');
  assert.equal(mapOverlayDraws({ ...base, mouse: [560 + 5, 340] }).filter((x) => x.kind === 'text').at(-1).text, 'a', 'five off, the range itself: named');
  const sc = mapOverlayDraws({ ...base, scale: [2, 1.5], screenRect: { x: 0, y: 0, width: 640, height: 400 } }).filter((x) => x.kind === 'quad');
  const r2 = mapRect({ x: 0, y: 0, width: 640, height: 400 }, [2, 1.5]);
  assert.deepEqual([sc[2].rect.x, sc[3].rect.y, sc[2].rect.h, sc[3].rect.w], [r2.x + 207 * 2 - 2, r2.y + f(213 * 1.5) - 2, 750, 2000], 'the cross at the player\'s pixel scaled, the lines the scaled map\'s length');
});

// ── the position box and its coroutine ───────────────────────────────────────────────────────────────────────────

test('CSA-I: the position box (112406) starts the reading - the instruments\' box, a wait while a message box is on top, the reading got at midday in the sun, the map up, the game paused under it every frame it is not', () => {
  const s = scene();
  const boat = s.place(2);
  assert.ok(boat.PositionTrigger, 'the Small Ship carries the position box');
  s.rt.activate(TRIGGER_MODEL.position, { root: boat.GameObject, node: boat.PositionTrigger, distance: 1 }, 'grab');
  assert.deepEqual(s.out.boxes, ['According to my instruments...']);
  assert.ok(s.rt.state.showingBoatPosition != null);
  s.frame(); s.frame();
  assert.equal(s.rt.state.mapShowingPosition, false, 'still waiting on the box');
  s.world.box = false;
  s.frame();   // the wait ends, and its yield
  assert.equal(s.rt.state.mapShowingPosition, false);
  s.frame();   // the reading
  assert.deepEqual([s.rt.state.mapShowingPosition, s.rt.state.mapShowing], [true, false]);
  s.frame();   // mapShowing, and its yield
  assert.deepEqual([s.rt.state.mapShowing, s.out.opens], [true, 0]);
  s.frame();   // the loop's first frame: PauseGame(true, true)
  assert.deepEqual([s.out.opens, s.world.paused], [1, true]);
  s.frame();
  assert.equal(s.out.opens, 1, 'paused: not again');
  s.world.paused = false; s.frame();
  assert.equal(s.out.opens, 2, 'unpaused from outside: paused again');
  // a second box while the first reading runs starts nothing
  s.rt.activate(TRIGGER_MODEL.position, { root: boat.GameObject, node: boat.PositionTrigger, distance: 1 }, 'grab');
  assert.equal(s.out.boxes.length, 1);
});

test('CSA-I: the reading\'s two restrictions - Sunny or Cloudy, and the hours 11, 12, 23 and 0 - else "...no good" and its wait; with both settings off any weather and any hour read', () => {
  const run = (weather, hour, settings = {}) => {
    const s = scene({ settings });
    const boat = s.place(2);
    s.world.weather = weather; s.world.hour = hour;
    s.rt.StartShowBoatPosition(boat);
    s.world.box = false;
    s.frame(); s.frame();
    return s;
  };
  for (const [w, h] of [[0, 12], [1, 11], [0, 23], [1, 0]]) assert.equal(run(w, h).rt.state.mapShowingPosition, true, `weather ${w} at ${h}`);
  for (const [w, h] of [[2, 12], [4, 12], [0, 10], [0, 13], [0, 22], [0, 1]]) {
    const s = run(w, h);
    assert.deepEqual([s.rt.state.mapShowingPosition, s.out.boxes.at(-1)], [false, "...no good. I can't get a reading at this time."], `weather ${w} at ${h}`);
    s.frame();
    assert.equal(s.rt.state.mapShowing, false, 'waiting on the no-good box');
    s.world.box = false;
    s.frame();
    assert.equal(s.rt.state.mapShowing, true, 'the map up after it, no reading on it');
  }
  const loose = run(4, 3, { 'Map.RestrictPositionReadingTime': false, 'Map.RestrictPositionReadingWeather': false });
  assert.equal(loose.rt.state.mapShowingPosition, true);
  assert.equal(run(0, 3, { 'Map.RestrictPositionReadingTime': false }).rt.state.mapShowingPosition, true);
  assert.equal(run(4, 12, { 'Map.RestrictPositionReadingWeather': false }).rt.state.mapShowingPosition, true);
});

test('CSA-I: on the map - the number row picks the colour, the left button places a marker (once a pixel, labelled with the day), the right removes the nearest within range, Escape\'s release unpauses and puts it away; a second of game time before another reading', () => {
  const s = scene();
  const boat = s.place(2);
  s.rt.StartShowBoatPosition(boat);
  s.world.box = false;
  for (let i = 0; i < 4; i++) s.frame();
  assert.equal(s.rt.state.mapShowing, true);
  s.frame({ down: ['Alpha3'] });
  assert.equal(s.rt.state.mapMarkerMode, 2);
  s.frame({ down: ['Alpha1', 'Alpha8'] });
  assert.equal(s.rt.state.mapMarkerMode, 7, 'the last of the frame\'s keys');
  s.mouseAtGui(560, 340);
  s.frame({ down: ['Alpha6', 'Mouse0'] });
  assert.deepEqual(s.rt.state.mapMarkers.map((m) => [m.position, m.label, m.color]), [[[100, 50], '(100, 50) - 5th of Morning Star', { ...MAP_MARKER_MODE_COLORS[5] }]], 'the colour picked the same frame');
  assert.ok(s.out.log.includes('COME SAIL AWAY - MOUSE IS OVER MAP PIXEL (100, 50)'));
  s.frame({ down: ['Mouse0'] });
  assert.equal(s.rt.state.mapMarkers.length, 1, 'once a pixel');
  s.mouseAtGui(100, 100);
  s.frame({ down: ['Mouse0'] });
  assert.equal(s.rt.state.mapMarkers.length, 1, 'off the map: nothing');
  s.mouseAtGui(560, 380);
  s.frame({ down: ['Mouse0'] });
  assert.deepEqual(s.rt.state.mapMarkers.map((m) => m.position), [[100, 50], [100, 90]], 'the same column, another row: marked');
  s.rt.state.mapMarkers.pop();
  s.mouseAtGui(563, 343);
  s.frame({ down: ['Mouse0'] });
  s.mouseAtGui(566, 346);
  s.frame({ down: ['Mouse0'] });
  assert.deepEqual(s.rt.state.mapMarkers.map((m) => m.position), [[100, 50], [103, 53], [106, 56]]);
  s.mouseAtGui(563, 343);
  s.frame({ down: ['Mouse1'] });
  assert.deepEqual(s.rt.state.mapMarkers.map((m) => m.position), [[100, 50], [106, 56]], 'the nearest');
  s.mouseAtGui(563, 343);
  s.frame({ down: ['Mouse1'] });
  assert.deepEqual(s.rt.state.mapMarkers.map((m) => m.position), [[100, 50]], 'of two as near, the later (walked from the end)');
  s.mouseAtGui(700, 400);
  s.frame({ down: ['Mouse1'] });
  assert.equal(s.rt.state.mapMarkers.length, 1, 'none within range: none removed');
  s.frame({ down: ['Escape'] });
  assert.equal(s.rt.state.mapShowing, true, 'the press is not the release');
  s.frame({ up: ['Escape'] });
  assert.deepEqual([s.rt.state.mapShowing, s.out.closes, s.world.paused], [false, 1, false]);
  s.frame();
  assert.ok(s.rt.state.showingBoatPosition != null, 'a second of game time still owed');
  s.rt.StartShowBoatPosition(boat);
  assert.equal(s.out.boxes.length, 1, 'no second reading within it (kept)');
  s.world.time = 0.99; s.rt.update();
  assert.ok(s.rt.state.showingBoatPosition != null);
  s.world.time = 1; s.rt.update();
  assert.equal(s.rt.state.showingBoatPosition, null);
  s.rt.StartShowBoatPosition(boat);
  assert.equal(s.out.boxes.length, 2);
});

test('CSA-I: the runtime\'s OnGUI map reads its state and settings live - the backdrop\'s percent, the three thicknesses (Left Shift held: nought), the click range - and none while the map is down', () => {
  const s = scene({ settings: { 'Map.BackdropOpacity': 80, 'Map.PositionLineThickness': 3, 'Map.MarkerThickness': 1, 'Map.MarkerOutlineThickness': 0, 'Map.ClickRangeThreshold': 2 } });
  assert.equal(s.rt.mapOverlay({ screenRect: SCREEN, screen: [1920, 1080], unscaledTime: 0.1 }), null);
  s.rt.state.mapShowing = true;
  s.rt.state.mapShowingPosition = true;
  s.rt.state.mapMarkers.push({ position: [10, 10], label: 'x', color: { ...MAP_MARKER_MODE_COLORS[0] } });
  s.mouseAtGui(472, 302);
  const d = s.rt.mapOverlay({ screenRect: SCREEN, screen: [1920, 1080], unscaledTime: 0.1 });
  const q = d.filter((x) => x.kind === 'quad');
  assert.equal(q[0].color.a, f(80 * f(0.01)));
  assert.deepEqual([q[2].rect.w, q.length, q[4].rect.w], [7, 5, 3], 'line 3, no outline, marker 1');
  assert.equal(d.filter((x) => x.kind === 'text').length, 6, 'two pixels off is the range: (2,2) is 2.83 away');
  s.world.held.add('LeftShift');
  const z = s.rt.mapOverlay({ screenRect: SCREEN, screen: [1920, 1080], unscaledTime: 0.1 }).filter((x) => x.kind === 'quad');
  assert.deepEqual([z[2].rect.w, z[4].rect.w], [1, 1]);
  s.settings['Map.MarkerOutlineThickness'] = 2;
  assert.equal(s.rt.mapOverlay({ screenRect: SCREEN, screen: [1920, 1080], unscaledTime: 0.1 }).filter((x) => x.kind === 'quad').length, 5, 'Shift held: no outline');
  s.world.held.delete('LeftShift');
  assert.equal(s.rt.mapOverlay({ screenRect: SCREEN, screen: [1920, 1080], unscaledTime: 0.1 }).filter((x) => x.kind === 'quad').length, 6, 'let go: its outline');
});

test('CSA-I: OnGUI\'s debug values - at the helm, unpaused and not loading, with Debug/ShowValues on: the speed, the speed made for and the wind\'s strength, G7, at scale 5 in red, green and blue', () => {
  const s = scene({ settings: { 'Debug.ShowValues': true } });
  const boat = s.place(1);
  assert.equal(s.rt.debugValues(), null, 'not at the helm');
  s.rt.StartSailing(boat);
  s.rt.state.velocityCurrent = [3, 0, 4];
  s.rt.state.velocityTarget = [0, 0, 0.5];
  s.rt.state.windVectorCurrent = [f(1 / 3), 0, 0];
  const v = s.rt.debugValues();
  assert.deepEqual(v.map((t) => [t.text, t.x, t.y, t.scale, t.color.r, t.color.g, t.color.b]), [['5', 0, 0, 5, 1, 0, 0], ['0.5', 500, 0, 5, 0, 1, 0], ['0.3333333', 0, 50, 5, 0, 0, 1]]);
  assert.deepEqual([v[0].shadow, v[0].shadowPos], [COLOR_BLACK, [2, 2]]);
  assert.equal(s.rt.debugValues({ paused: true }), null);
  assert.equal(s.rt.debugValues({ loading: true }), null);
  s.settings['Debug.ShowValues'] = false;
  assert.equal(s.rt.debugValues(), null);
});

// ── the water walk ───────────────────────────────────────────────────────────────────────────────────────────────

test('CSA-I: the water walk - in a hull\'s collider box (a column without Iliac Puddle No More) StartWaterwalking assigns "I\'m On A Boat" once; out of every box EndWaterwalking takes it off - or "Jesus Mode" - and leaves a spell\'s alone', () => {
  const s = scene();
  const boat = s.place(1, 0, [100, 34, 200]);
  const inBoat = boat.MeshObject.position.map((v, k) => (k === 1 ? v + 500 : v));
  s.world.player = inBoat;
  s.rt.lateUpdate();
  assert.deepEqual(s.out.assigned, [{ name: BOAT_EFFECT_BUNDLE, bundleType: 'Spell', targetType: 'CasterOnly', effectKey: WATER_WALKING_SILENT, durationBase: 90000, durationPlus: 0, durationPerLevel: 1, bypassSavingThrows: true }], '500 m above the hull: still in its column');
  s.rt.lateUpdate();
  assert.equal(s.out.assigned.length, 1, 'walking: not again');
  s.world.ipnm = true;
  s.rt.lateUpdate();
  assert.deepEqual(s.out.removed, [BOAT_EFFECT_BUNDLE], 'with Iliac Puddle No More the box has a height, and 500 m is out of it');
  s.world.player = boat.MeshObject.position.slice();
  s.rt.lateUpdate();
  assert.equal(s.out.assigned.length, 2, 'in the box itself');
  // off the boat: the first of the two names goes
  s.world.player = [5000, 0, 5000];
  s.world.bundles = ['Levitate', 'Jesus Mode', BOAT_EFFECT_BUNDLE];
  s.rt.lateUpdate();
  assert.deepEqual(s.out.removed.at(-1), 'Jesus Mode');
  // a spell's water walk off the boat: nothing to take, asked again every frame (kept)
  s.world.bundles = ['Water Walking']; s.world.walking = true;
  const before = s.out.removed.length;
  s.rt.lateUpdate(); s.rt.lateUpdate();
  assert.equal(s.out.removed.length, before);
  // the bundle standing while the flag reads false: StartWaterwalking finds it and assigns none
  s.world.ipnm = false;
  s.world.player = inBoat;
  s.world.bundles = [BOAT_EFFECT_BUNDLE]; s.world.walking = false;
  s.rt.lateUpdate();
  assert.equal(s.out.assigned.length, 2, 'one of the name already live');
  // an inactive boat is no box; a paused frame asks nothing
  s.world.bundles = []; s.world.walking = false;
  boat.GameObject.setActive(false);
  s.world.player = inBoat;
  s.rt.lateUpdate();
  assert.equal(s.out.assigned.length, 2);
  boat.GameObject.setActive(true);
  s.rt.lateUpdate({ paused: true });
  assert.equal(s.out.assigned.length, 2);
  // no effect manager: nothing
  const bare = scene({ noEffects: true });
  bare.place(1, 0, [100, 34, 200]);
  bare.world.player = inBoat;
  assert.doesNotThrow(() => bare.rt.lateUpdate());
});

test('CSA-I: WaterWalkingSilent on the port\'s effect list - its own kind (no stacking onto the spell\'s), IsWaterWalking either way, a bundle of its name with no icon, its first round run on the assign, RemoveBundle taking the first of the name whole', () => {
  const e = { activeEffects: [] };
  assert.equal(isEntityWaterWalking(e), false);
  const entry = assignModBundle(e, { name: BOAT_EFFECT_BUNDLE, kind: WATER_WALKING_SILENT_KIND, rounds: 90000 });
  assert.equal(entry.roundsRemaining, 89999, 'AssignBundle\'s initial round');
  assert.deepEqual([entry.bundleName, entry.bundleType, entry.bundleSelfCast, isEntityWaterWalking(e), hasActiveEffect(e, 'waterWalking')], [BOAT_EFFECT_BUNDLE, 'Spell', true, true, false]);
  const b = liveBundles(e);
  assert.deepEqual(b.map((x) => [x.name, x.showIcon]), [[BOAT_EFFECT_BUNDLE, false]], 'ShowSpellIcon false');
  tickActiveEffects(e, {});
  assert.equal(entry.roundsRemaining, 89998);
  e.activeEffects.push({ kind: 'waterWalking', roundsRemaining: 5, bundleId: 9999, bundleName: 'Water Walking' });
  const second = assignModBundle(e, { name: BOAT_EFFECT_BUNDLE, kind: WATER_WALKING_SILENT_KIND, rounds: 3 });
  assert.notEqual(second.bundleId, entry.bundleId);
  assert.equal(removeBundleNamed(e, BOAT_EFFECT_BUNDLE), true);
  assert.deepEqual(e.activeEffects.map((a) => a.bundleName), ['Water Walking', BOAT_EFFECT_BUNDLE], 'the first of the name, whole');
  assert.equal(removeBundleNamed(e, 'Nothing'), false);
  e.activeEffects = e.activeEffects.filter((a) => a.kind !== WATER_WALKING_SILENT_KIND);
  assert.equal(isEntityWaterWalking(e), true, 'the spell\'s alone still walks');
});

// ── the host's seams ─────────────────────────────────────────────────────────────────────────────────────────────

test('CSA-I: the host\'s seams - the map\'s window (a native window: every key, its key-ups, OnGUI\'s draw), rotated with the host\'s edges; the mouse bottom up; the two pictures off the player\'s files; the draw\'s shadow then text; the debug values beside the widget; IsWaterWalking read one way everywhere', () => {
  const w = src('scenes/world.js');
  assert.match(w, /topWindowIsMessageBox: \(\) => \(modes\?\.topWindow\?\.\(\) \?\? null\) instanceof ActionTextBox,/);
  assert.match(w, /map: \{ open: \(\) => csaMapOpen\(\), close: \(\) => csaMapClose\(\) \},/);
  assert.match(w, /isChoiceWindow: true,\s*get done\(\) \{ return _csaMapWindow !== win; \},\s*input\(code, e\) \{ if \(!e\?\.repeat\) _csaMapKeys\.down\.add\(code\); _csaMapKeys\.held\.add\(code\); \},\s*keyup\(code\) \{ if \(_csaMapKeys\.held\.delete\(code\)\) _csaMapKeys\.up\.add\(code\); \},/);   // AUDIT PRE-MERGE 0928 U1: the release its own press made (test/systems/audit0928_input.test.js)
  assert.match(w, /draw\(\) \{ csaDrawMap\(\); \},/);
  assert.match(w, /if \(modes\?\.mountWindow\?\.\(win\)\) _csaMapWindow = win;/);
  assert.match(w, /beginInputFrame\(latch\.edge\); csaInputFrame\(\);/);
  assert.match(w, /keyDown: \(k\) => \{ const c = csaKeyCode\(k\); return !!latch\.edge\?\.downFrame\?\.has\(c\) \|\| _csaMapKeys\.downFrame\.has\(c\); \},/);
  assert.match(w, /keyUp: \(k\) => \{ const c = csaKeyCode\(k\); return !!latch\.edge\?\.upFrame\?\.has\(c\) \|\| _csaMapKeys\.upFrame\.has\(c\); \},/);
  assert.match(w, /\.\.\.csaInput,/);
  assert.match(w, /_csaMouse = \[\(e\.clientX - r\.left\) \* \(canvas\.width \/ r\.width\), canvas\.height - \(e\.clientY - r\.top\) \* \(canvas\.height \/ r\.height\)\];/);
  assert.match(w, /img\.load\(await fetchBytes\(TRAVEL_MAP_IMG\), TRAVEL_MAP_IMG\);/);
  assert.match(w, /renderer\.uploadTexture\('img', 'csa-map', csaToScreenOrder\(travelMapPicture\(img\.getDFBitmap\(0, 0\), \(i\) => pal\.get\(i\)\)\)\)/);
  assert.match(w, /getTexture\(CSA_LINE_TEXTURE\.archive\)\.then\(\(t\) => \{\s*_csaLineTex = renderer\.uploadTexture\('img', 'csa-line', t\.getColor32\(t\.getDFBitmap\(CSA_LINE_TEXTURE\.record, CSA_LINE_TEXTURE\.frame\), 0\)\);/);
  assert.match(w, /drawText\(renderer, font, d\.text, d\.x \+ d\.shadowPos\[0\], d\.y \+ d\.shadowPos\[1\], d\.scale, rgba\(d\.shadow\)\);\s*drawText\(renderer, font, d\.text, d\.x, d\.y, d\.scale, rgba\(d\.color\)\);/);
  assert.match(w, /const values = csaRuntime\.debugValues\(\{ paused: gamePaused\(\) \}\);[^\n]*\n\s*if \(values\) csaDrawList\(values\);/);
  assert.match(w, /assignModBundle\(playerEntity, \{ name: spec\.name, kind: WATER_WALKING_SILENT_KIND, rounds, bundleType: spec\.bundleType \}\);/);
  assert.match(w, /removeBundle: \(name\) => removeBundleNamed\(playerEntity, name\),/);
  const m = src('scenes/worldModes.js');
  assert.match(m, /topWindow: \(\) => \(mode === 'dungeon' \? \(dungeonCtx\?\.overlayWindow\?\.\(\) \?\? null\) : mode === 'interior' \? interiorOverlay : \(townTalk\?\.overlay \?\? null\)\),/);
  assert.match(src('scenes/shared.js'), /player\.waterWalking = isEntityWaterWalking\(entity\);/);
  const dc = src('scenes/dungeonContext.js');
  assert.match(dc, /playerWaterWalking: \(\) => isEntityWaterWalking\(playerEntity\),/);
  assert.match(dc, /waterWalking: isEntityWaterWalking\(playerEntity\) \} : null;/);
  assert.doesNotMatch(src('scenes/shared.js') + dc, /hasActiveEffect\((entity|playerEntity), 'waterWalking'\)/, 'no reader of the one kind alone');
});
