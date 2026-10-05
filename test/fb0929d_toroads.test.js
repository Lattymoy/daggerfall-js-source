// TO-ROADS (FIELD BUGS 2026-09-29d; SylviaBun on the Discord, #bug-reports, "Travel Options First Person doesn't follow
// roads like Overworld Travel Options does": "With the new Overworld type of travel, you can travel sticking almost
// entirely to roads without any additional effort. When traveling in first person, however, the travel route always just
// goes the straightest shot to your destination running you through the forest etc. A way to toggle this behavior to
// match or not would be nice"). OW-TOGGLE gave First-Person Travel back as Travel Options' own journey: its autopilot
// aims at the destination's rect, straight through whatever stands between. The port's own key beside it on the mod's
// pane (`GeneralOptions.FirstPersonTravelFollowsRoads`, OFF - First-Person Travel stays the original travel option Mac
// asked back) makes a map pick the Overworld's ROUTE instead - its planner, its legs, its refusals - walked in first
// person, the view never raised.
//
// Pinned here: the key (declared, off, a toggle, its words, on the tile beside the switch it serves, the player's own
// online); the report REPRODUCED first and then fixed on the host's own code - world.js's doors (tvOwnsJourneys,
// tvRoutesJourneys, beginAcceleratedTravel, travelViewResume, tvJourneyUp, the view's onLower, the map's onTravel and
// onTravelToCoords) and the Overworld's route (travelViewRouteTo, travelViewWalkTo, tvJoinedLegs, tvSeaNoWay, the view's
// gate and their small helpers) LIFTED from its source and run over the REAL planner (systems/travelRoute.js), a REAL
// Travel Options and the real settings store on a small map of our own (a road bent round a square of forest, a
// mountain, an island); the journey's life (the mod's panel, a foe's stop, Camp, the party's walk, the map's Resume
// planned again, the arrival's box, the view's own doors, the clock); the route's refusal (said, and done: never the
// straight walk, never DFU's fast travel); both switches both ways and the classic skin, read live; and THE ONE
// CONSTRUCTION SEAM, swept in the source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { MOD_CURATED, modDials } from '../src/systems/features.js';
import { ONLINE_PLAYERS_OWN_MODS, onlineForcedModSetting } from '../src/systems/onlineLane.js';
import { createTravelOptions, readTravelOptionsSettings, TRAVEL_OPTIONS_VENDOR } from '../src/systems/travelOptions.js';
import { TRAVEL_OPTIONS_TEXT } from '../src/systems/travelOptionsText.js';
import { mapPixelWorldOrigin } from '../src/systems/travelPaths.js';
import { rectOf } from '../src/systems/travelAutopilot.js';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { planRoute, routeLegs, routeGround, joinPoint, routeDrawPoints, roadShare, crossesWater, dryLine, TV_MOUNTAIN_CLIMATE } from '../src/systems/travelRoute.js';
import { WATER_BYTE } from '../src/world/roadsProducer.js';
import { DIR_DELTA } from '../src/world/roadNetwork.js';
import { worldCoordToMapPixel } from '../src/formats/mapsFile.js';
import { TRAVEL_VIEW_TEXT, travelTripLine, travelWalkRate, TV_MOVE_ACTIONS } from '../src/scenes/travelView.js';
import { createLoadGovernor, unbuiltAround } from '../src/systems/travelGovernor.js';
import { foePaced } from '../src/systems/travelThreat.js';   // RATE-LAW: ENEMY-PACE's fixed floor, which the governor calls
import { travelPathUsesRoads, TRAVEL_PATH_TEXT, setTravelPathMode } from '../src/systems/travelPathMode.js';
import { timeScale, setTimeScale, resetTimeScale, MAX_TIME_SCALE } from '../src/systems/timeScale.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const KEY = 'GeneralOptions.FirstPersonTravelFollowsRoads';
const FIRST_PERSON = 'GeneralOptions.FirstPersonTravel';
/** Run `fn` on a page whose URL is `search` (the read paths read globalThis.location.search; node has none). */
const onPage = (search, fn) => { const had = globalThis.location; globalThis.location = { search }; try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; } };

test('TO-ROADS THE SWITCH: the port\'s own key beside First-Person Travel - OFF (First-Person Travel stays the mod\'s straight journey), a toggle, its own words, on the tile right after the switch it serves; the vendored modsettings.json does not carry it; online it is the player\'s own (the room owns only the mod\'s switch and its two journey dials - TRAVEL-ONLINE)', () => {
  const def = MOD_SETTINGS['travel-options'].keys[KEY];
  assert.ok(def, 'declared on Travel Options\' pane');
  assert.equal(def.default, false, 'OFF - First-Person Travel keeps "the original travel option" (Mac, OW-TOGGLE)');
  assert.equal(typeof def.default, 'boolean', 'a toggle');
  assert.match(def.description, /^With First Person Travel on, a journey picked on the travel map follows the roads and tracks as the Overworld’s journeys do - planned round the mountains, and refused where no way by land reaches - and is walked in first person, the Overworld view not raised\./);
  assert.match(def.description, / Off, it walks straight to its destination, as Travel Options does\./);
  assert.match(def.description, / Takes effect at once\. /, 'read live, as First-Person Travel is (AUDIT OW5 T1) - the tile\'s "when the world next loads" is the mod\'s other keys\'');
  assert.match(def.description, /\(This port’s own switch - the mod has none\.\)$/);
  const shipped = JSON.parse(read('vendor/travel-options/modsettings.json'));
  assert.ok(!shipped.Sections.flatMap((s) => s.Keys.map((k) => `${s.Name}.${k.Name}`)).includes(KEY), 'the author\'s file is untouched');
  const tile = MOD_CURATED['travel-options'];
  assert.equal(tile.indexOf(KEY), tile.indexOf(FIRST_PERSON) + 1, 'on the tile, right after the switch it serves');
  assert.ok(modDials('travel-options').includes(KEY), 'reachable: a dial the drawer draws (TORCH-BIND\'s lesson)');
  _resetModSettings();
  assert.equal(modSetting(TRAVEL_OPTIONS_VENDOR, KEY), false, 'the shipped store: off');
  assert.ok(!ONLINE_PLAYERS_OWN_MODS.includes('travel-options'), 'TRAVEL-ONLINE: the room owns three of Travel Options\' keys');
  assert.equal(onlineForcedModSetting('travel-options', KEY, '?online=1'), undefined, 'and not this one: the room forces nothing here');
  onPage('?online=1', () => {
    setModSetting(TRAVEL_OPTIONS_VENDOR, KEY, true);
    assert.equal(modSetting(TRAVEL_OPTIONS_VENDOR, KEY), true, 'online, the player\'s own answer');
  });
  _resetModSettings();
});

// ── the host, lifted: world.js's own doors and the Overworld's own route, run over the real planner ─────────────────

/** One of world.js's own functions, by name: a one-line declaration, or up to its closing brace at the host's indent. */
function fnSource(name) {
  const at = WORLD.indexOf(`  function ${name}(`);
  assert.ok(at >= 0, `world.js declares ${name}`);
  const eol = WORLD.indexOf('\n', at);
  if (WORLD.slice(at, eol).trimEnd().endsWith('}')) return WORLD.slice(at, eol);
  return WORLD.slice(at, WORLD.indexOf('\n  }\n', at) + 4);
}
/** One of world.js's own one-line declarations at the host's indent, whole - declared once. */
function lineSource(head) {
  const at = WORLD.indexOf(`\n  ${head}`);
  assert.ok(at >= 0, `world.js declares ${head}`);
  assert.equal(WORLD.indexOf(`\n  ${head}`, at + 1), -1, `${head} is declared once`);
  return WORLD.slice(at + 3, WORLD.indexOf('\n', at + 1));
}
/** A const arrow of the host's, up to its closing brace at the host's indent. */
function constBlock(name) {
  const at = WORLD.indexOf(`\n  const ${name} = () => {\n`);
  assert.ok(at >= 0, `world.js declares ${name}`);
  return WORLD.slice(at + 1, WORLD.indexOf('\n  };\n', at) + 5);
}
/** A piece the host hands the view or the map, by its own shape. */
function grab(re, what) { const m = re.exec(WORLD); assert.ok(m, `world.js: ${what}`); return m[1]; }
const ON_LOWER = grab(/\n\s*onLower: (\(why\) => \{[^\n]*\}),\n/, 'the view\'s onLower');
const ON_TRAVEL = grab(/buildTravelMapWindow\(\{ onTravel: (\(pick, opts, computed\) => \{\n[\s\S]*?\n {4}\}) \}\);/, 'the map\'s onTravel');
const ON_COORDS = grab(/\n\s*onTravelToCoords: (\(pick, opts\) => \{ [^\n]*? \}),/, 'the map\'s onTravelToCoords');
const HOST = [
  lineSource('const TV_SEA_EPS_M = '), lineSource('const tvQuiet = '), lineSource('const tvTrip = '), lineSource('const tvWater = '),
  lineSource('let _tvRouteGround = null;'), lineSource('let _tvRocksFrom = null, _tvRocksRoads = null, _tvRocks = null;'), fnSource('tvWodRocks'), lineSource('const tvRouteGround = '), lineSource('const tvLegMid = '), lineSource('const tvSeaAsk = '),
  lineSource('const _tvTownRects = new Map();'), fnSource('tvTownRects'), fnSource('tvRingAt'),   // OW-WOD-PATH, OW-TOWN-RING: the host's own (no World of Daggerfall list here; no location on the way)
  constBlock('travelViewAllowed'),
  fnSource('tvOwnsJourneys'), fnSource('tvRoutesJourneys'), fnSource('tvMapForcesRoads'), fnSource('travelViewResume'), fnSource('beginAcceleratedTravel'),
  fnSource('travelViewRouteTo'), fnSource('tvFreePull'), fnSource('tvJoinedLegs'), fnSource('travelViewWalkTo'), fnSource('tvJourneyUp'),
  fnSource('tvMooredDry'), fnSource('tvSeaNoWay'), fnSource('travelViewCanGo'),
  `const onLower = ${ON_LOWER};`, `const onTravel = ${ON_TRAVEL};`, `const onTravelToCoords = ${ON_COORDS};`,
  'return { tvOwnsJourneys, tvRoutesJourneys, travelViewResume, beginAcceleratedTravel, tvJourneyUp, onLower, onTravel, onTravelToCoords, tvTrip };',
].join('\n');

// THE MAP, a small one of our own on the whole 1000x500 grid: a road from the traveller's pixel (500, 250) north to
// (500, 245), east to (510, 245) and south into Ripwych's pixel (510, 250) - bent round five pixels of forest the straight
// line crosses; a Mountain pixel west at (490, 250); an island town, Isle, at (530, 250) in a ring of water.
const W = 1000, H = 500, idx = (x, y) => y * W + x;
const ROADS = new Uint8Array(W * H);
const ROAD = [];
for (let y = 250; y >= 245; y--) ROAD.push([500, y]);
for (let x = 501; x <= 510; x++) ROAD.push([x, 245]);
for (let y = 246; y <= 250; y++) ROAD.push([510, y]);
for (let i = 1; i < ROAD.length; i++) {   // Hazelnut's own shape: a step is on the road when both ends carry the edge
  const [ax, ay] = ROAD[i - 1], [bx, by] = ROAD[i];
  ROADS[idx(ax, ay)] |= DIR_DELTA.find(([, dx, dy]) => dx === bx - ax && dy === by - ay)[0];
  ROADS[idx(bx, by)] |= DIR_DELTA.find(([, dx, dy]) => dx === ax - bx && dy === ay - by)[0];
}
const NET = { roads: ROADS, tracks: new Uint8Array(W * H), source: 'basic-roads' };
const SEA = new Set();
for (let y = 248; y <= 252; y++) for (let x = 528; x <= 532; x++) if (x !== 530 || y !== 250) SEA.add(`${x},${y}`);
const PEAK = { x: 490, y: 250 };
const heightAt = (x, y) => (SEA.has(`${x},${y}`) ? 0 : 60);
const climateAt = (x, y) => (x === PEAK.x && y === PEAK.y ? TV_MOUNTAIN_CLIMATE : 231);
/** A point in a map pixel, native units (the pixel's middle by default). */
const at = (px, py, dx = 16384, dz = 16384) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + dx, z: o.z + dz }; };
const placeRect = (p) => { const o = mapPixelWorldOrigin(p.x, p.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); };
const PLACES = new Map([
  ['510,250', { pixel: { x: 510, y: 250 }, name: 'Ripwych', mapId: 42, regionIndex: 17, locationIndex: 3 }],
  ['530,250', { pixel: { x: 530, y: 250 }, name: 'Isle', mapId: 43, regionIndex: 17, locationIndex: 4 }],
]);
const pick = (x, y) => { const p = PLACES.get(`${x},${y}`); return p ? { ...p } : { pixel: { x, y }, name: '' }; };
const WALKED = { playerControlled: true, speedCautious: false, sleepModeInn: false, travelShip: false };   // the popup's word for a walked trip
const xy = (l) => ({ x: l.x, y: l.y });

/** One world host: its doors and its route lifted from world.js over a REAL Travel Options (its panel, its autopilot, its
 *  Update) and the real settings store. What is stubbed is the world around the block: the boat (none to hand), the
 *  ship's passage (its own law refuses: no port here - SHIP-SAIL's suite), the scene (native units, flat ground), the
 *  party's walk (recorded - TV8's suite runs it), the fast travel (recorded). */
function host({ firstPerson = false, roads = false, enhanced = true } = {}) {
  _resetModSettings();
  if (firstPerson) setModSetting(TRAVEL_OPTIONS_VENDOR, FIRST_PERSON, true);
  if (roads) setModSetting(TRAVEL_OPTIONS_VENDOR, KEY, true);
  const h = { said: [], talk: [], hud: [], boxed: [], fast: [], party: [], offered: [], enemies: false, me: at(500, 250, 5000, 16384) };   // west of the road's lane: it is JOINED first (OW-ROADSIDE)
  const view = { state: 'off', active: false, enter() { view.state = 'up'; view.active = true; } };
  let to = null;
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: () => to?.interruptTravel(), onCancel: () => to?.clearTravelDestination() });   // the host's own: Camp interrupts, Exit forgets
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  to = createTravelOptions({
    settings, ui,
    roads: () => NET, isWater: (x, y) => heightAt(x, y) <= WATER_BYTE,
    worldPos: () => h.me, mapPixel: () => worldCoordToMapPixel(h.me.x, h.me.z), yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false,
    localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231,
    entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => h.enemies, diseaseCount: () => 0,
    say: (l) => h.hud.push(l), messageBox: (l) => h.boxed.push(l),
    setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => placeRect(s.pixel),
    locationTileRect: () => null,
    pushWindow: (w) => { w.show(); },   // the world host's own: the panel is shown, not stacked
  });
  const refuse = (what) => () => { throw new Error(`${what}: a door's walk, not this slice's`); };
  const env = {
    travelOptions: to, travelView: view, isEnhanced: () => enhanced, modSetting, TRAVEL_OPTIONS_VENDOR, TRAVEL_VIEW_TEXT,
    params: new URLSearchParams(''), walkMode: true, playerSpawned: true, modes: { mode: 'exterior', modalWindowUp: () => false }, playerEntity: { health: 50 }, dwPlayer: null,
    tvSay: (l) => h.said.push(l), townTalk: { say: (l) => h.talk.push(l) },
    tvPlaceSummary: (x, y) => { const p = PLACES.get(`${x},${y}`); return p ? { ...p, loc: {} } : null; },
    tvPlaceRect: (s) => { const r = placeRect(s.pixel); return { cx: (r.xMin + r.xMax) / 2, cz: (r.zMin + r.zMax) / 2 }; },
    mapPixelToWorldCoords: mapPixelWorldOrigin, tvSceneOf: (nx, nz, lift = 0) => [nx, 10 + lift, nz], tvSeaY: () => 0,
    state: { worldCoords: (p) => ({ x: p[0], z: p[2] }) }, player: { get pos() { return [h.me.x, 10, h.me.z]; } },
    playerTravelPixel: () => worldCoordToMapPixel(h.me.x, h.me.z),
    terrainGen: { roads: () => NET }, maps: { getClimateIndex: climateAt }, woods: { getHeightMapValue: heightAt }, WATER_BYTE, wod: null, _locationToBuild: () => null,
    planRoute, routeGround, routeLegs, joinPoint, routeDrawPoints, roadShare, crossesWater, dryLine, TV_MOUNTAIN_CLIMATE, travelTripLine,
    travelPathUsesRoads, TRAVEL_PATH_TEXT,   // OW-PATH (main's Roads / Free switch on the Overworld's bar): the route asks it
    tvSeaMeans: () => null, tvSeaBegin: () => {}, csaRuntime: null, csaOn: () => false, csaAboard: { aboard: false },
    tvOfferPassage: (place) => { h.offered.push(place.name); return false; },
    tvCautious: () => false, partyWalkBegin: (dest) => h.party.push(dest), travelGovernor: { reset() {} },
    dungeonApproach: refuse('dungeonApproach'), lastLegStart: refuse('lastLegStart'), pixelBox: refuse('pixelBox'),
    gamePaused: () => false, duelEnemyNear: () => false, areEnemiesNearby: () => false, exteriorFoePool: () => [],
    partyTravel: { propose: () => false }, hudFade: { clearFade() {} }, fastTravelTo: (p) => h.fast.push(p.name),
  };
  Object.assign(h, new Function(...Object.keys(env), HOST)(...Object.values(env)));
  Object.assign(h, { to, ui, view });
  h.stand = (p) => { h.me = { x: p.x, z: p.z }; };
  h.frame = () => to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false });
  h.journeying = () => !!to.isTravelActive && !!to.state.autopilot;
  /** The autopilot's aim, walked to: the traveller stood on it, two of the mod's frames (the pixel read, then the
   *  arrival - and the next leg aimed, by the same Update). */
  h.step = () => { const ap = to.state.autopilot, aim = { ...ap.destinationMapPixel }; h.stand(ap.destinationCentre); h.frame(); h.frame(); return aim; };
  h.walk = () => { const aims = []; while (to.state.autopilot && aims.length < 12) aims.push(h.step()); return aims; };
  return h;
}

test('TO-ROADS REPRODUCED, then fixed (the host\'s own code over the real planner and a real Travel Options): First-Person Travel\'s pick aimed the autopilot straight at the place, through the forest the road goes round; with its roads on the pick is the Overworld\'s own route - joined, then walked leg by leg along the road by the mod\'s own autopilot - the party asked along, the view never raised, and the arrival the mod\'s own box', () => {
  // THE REPORT, as it stood: First-Person Travel on, its roads off (the default)
  const off = host({ firstPerson: true });
  assert.deepEqual([off.tvOwnsJourneys(), off.tvRoutesJourneys()], [false, false]);
  off.onTravel(pick(510, 250), WALKED, { minutes: 90 });
  assert.equal(off.to.route, null, 'no route: Travel Options\' own journey');
  assert.equal(off.to.destinationName, 'Ripwych');
  assert.deepEqual(off.walk(), [{ x: 510, y: 250 }], 'REPRODUCED - the autopilot aimed at the place itself, the straightest shot, through the forest');
  assert.deepEqual([off.party, off.fast, off.said], [[], [], []], 'asked nobody (OW-TOGGLE\'s group travel), no teleport, nothing said');
  // THE FIX: its roads on
  const on = host({ firstPerson: true, roads: true });
  assert.deepEqual([on.tvOwnsJourneys(), on.tvRoutesJourneys()], [false, true], 'the Overworld owns nothing - and the trip is routed');
  on.onTravel(pick(510, 250), WALKED, { minutes: 90 });
  assert.deepEqual(on.to.route.legs.map((l) => [l.x, l.y, l.kind]), [[500, 250, 'open'], [500, 245, 'road'], [510, 245, 'road'], [510, 250, 'road']],
    'the Overworld\'s planner: the road JOINED first in the traveller\'s own pixel (OW-ROADSIDE), then along it');
  assert.equal(on.to.route.legs[0].at.x, at(500, 250).x, 'joined at the road\'s own lane');
  assert.equal(on.to.route.summary.name, 'Ripwych', 'a NAMED journey - LocationPause and the map\'s Resume know it');
  assert.equal(on.to.destinationName, 'Ripwych');
  assert.equal(on.ui.isShowing, true, 'the mod\'s own panel rides along');
  assert.equal(on.tvTrip.line, 'To Ripwych, by the road', 'the Overworld\'s line for it, drawn if the view is raised by hand');
  assert.deepEqual(on.party, [{ pixel: { x: 510, y: 250 } }], 'TV8: a leader\'s route leads the party gathered - the same legs for every member');
  on.tvJourneyUp();
  assert.deepEqual([on.view.state, on.view.active], ['off', false], 'walked in first person - the Overworld never rises with it');
  assert.deepEqual(on.walk(), [{ x: 500, y: 250 }, { x: 500, y: 245 }, { x: 510, y: 245 }, { x: 510, y: 250 }], 'THE ROAD, leg by leg - the join, the bend north, the bend east, then the place');
  assert.deepEqual([on.to.isTravelActive, on.to.cleared, on.boxed], [false, 1, [TRAVEL_OPTIONS_TEXT.MsgArrived]], 'arrived: the mod\'s own box, as its first-person journey ends (the view is down)');
  assert.deepEqual([on.fast, on.said, on.talk], [[], [], []]);
  _resetModSettings();
});

/** world.js's governor, mounted from its own source (test/ow_toggle.test.js's way): `let tvHeld` through travelViewGovern. */
function mountGovernor(env) {
  const from = WORLD.indexOf('  let tvHeld = null;');   // RATE-LAW: ENEMY-PACE's stepper rate is gone - its floor is travelThreat.js foePaced
  const fn = WORLD.indexOf('  function travelViewGovern(dt) {', from);
  const end = WORLD.indexOf('\n  }\n', fn) + 4;
  assert.ok(from >= 0 && fn > from && end > fn, 'the governor\'s source');
  const names = Object.keys(env);
  return new Function(...names, `${WORLD.slice(from, end)}\nreturn { govern: travelViewGovern, held: () => tvHeld };`)(...names.map((k) => env[k]));
}

test('TO-ROADS, the journey\'s life (the host\'s own code): a foe stops it as the mod stops its own, Camp keeps the place; the view raised by hand and brought down stops nothing; the map\'s Resume plans it AGAIN from where the traveller stands; its clock is the speed asked, never AUDIT OW4 J5\'s x1 - that is the Overworld\'s own journey\'s alone', () => {
  const h = host({ firstPerson: true, roads: true });
  h.onTravel(pick(510, 250), WALKED, { minutes: 90 });
  const first = h.to.route;
  assert.deepEqual([h.step(), h.step()], [{ x: 500, y: 250 }, { x: 500, y: 245 }], 'the join, the first bend');
  // the Overworld raised by hand over it (its own button), then brought down by the player - every way
  h.view.state = 'up'; h.view.active = true;
  h.onLower('button'); h.onLower('escape'); h.onLower('key');
  assert.equal(h.journeying(), true, 'brought down: the first-person route walks on, as First-Person Travel\'s own journey does');
  h.view.state = 'off'; h.view.active = false;
  // a foe: the mod's own stop, through its panel
  h.enemies = true;
  assert.equal(h.frame().stopped, 'enemies');
  h.enemies = false;
  assert.deepEqual([h.to.isTravelActive, h.to.state.autopilot, h.to.destinationName, h.to.route === first, h.boxed], [false, null, 'Ripwych', true, [TRAVEL_OPTIONS_TEXT.MsgEnemies]],
    'stopped as the mod stops its own journey (Camp: the panel down), the place and its route kept for the Resume');
  // walked on by hand along the road, then the map's Resume
  h.stand(at(505, 245));
  h.travelViewResume();
  assert.notEqual(h.to.route, first, 'PLANNED AGAIN (AUDIT OW5 J1: the route\'s re-plan, whoever owns the journey) - never the mod\'s straight resume');
  assert.deepEqual(h.to.route.legs.map(xy), [{ x: 505, y: 245 }, { x: 510, y: 245 }, { x: 510, y: 250 }], 'from where the traveller stands, along the road');
  assert.deepEqual([h.journeying(), h.view.state, h.party.length], [true, 'off', 2], 'walking again, in first person - the party set out again with it');
  // the clock, run by world.js's own governor with the view down: the route walked in first person runs at the speed
  // asked; the Overworld's own journey is held at x1 until its view rises
  for (const [owns, want] of [[false, 20], [true, 1]]) {
    resetTimeScale();
    setTimeScale(20);   // the journey's own ask, set by the mod's panel
    const g = mountGovernor({
      travelControlUI: { isShowing: true },   // RATE-LAW: no spinner, no limit - the journey's ask is travelAsked below
      foePaced, travellerOnRoad: () => false,
      travelOptions: { state: { autopilot: {} } },
      travelWalkRate, TV_MOVE_ACTIONS,
      travelView: { active: false, state: 'off' },   // the view left down
      held: () => false, keys: new Set(), walkMode: true, playerSpawned: true, player: { isPlayerSwimming: false },
      csaBoatUnderMe: () => null, gamePaused: () => false,
      setWorldTimeScale: setTimeScale, worldTimeScale: timeScale, resetTimeScale,
      travelAsked: 20, csaHoldsTimeScale: () => false, travelGovernor: createLoadGovernor({ max: MAX_TIME_SCALE }),
      state: { terrainDistance: 3 }, playerTravelPixel: () => ({ x: 505, y: 245 }), tvGroundGenNow: () => 0,
      unbuiltAround, built: { has: () => true },
      tvOwnsJourneys: () => owns, tvRoutesJourneys: () => true,   // both journeys are routes; only the Overworld's is OWNED
      journeyThreatCap: () => ({ cap: Infinity }), journeySlowSaid: () => {},   // OW6: no enemy about
    });
    g.govern(1 / 60);
    assert.equal(timeScale(), want, owns ? 'the Overworld\'s own journey on the ground: x1 until the view rises' : 'the first-person route: its own x20');
    assert.equal(g.held(), owns ? 1 : null);
  }
  resetTimeScale();
  _resetModSettings();
});

test('TO-ROADS, the route\'s REFUSAL is the answer (the host\'s own code): a place no way by land reaches is refused in the Overworld\'s words, the ship\'s passage asked first - never the straight walk into the sea, never DFU\'s fast travel; a spot among the peaks refused and said ONCE; a spot on open ground routed as the Overworld routes it', () => {
  const h = host({ firstPerson: true, roads: true });
  h.onTravel(pick(530, 250), WALKED, { minutes: 300 });
  assert.deepEqual(h.offered, ['Isle'], 'a boat would make it: the map\'s ship passage is offered first (SHIP-SAIL - its own law refuses here)');
  assert.deepEqual(h.said, [TRAVEL_VIEW_TEXT.noWay], '"There is no way there by land."');
  assert.deepEqual([h.to.isTravelActive, h.to.route, h.to.destinationName], [false, null, null], 'no journey begun - never the mod\'s straight walk out into the water');
  assert.deepEqual(h.fast, [], 'and never DFU\'s fast travel - a paid teleport past the route\'s own law (AUDIT OW3 J2)');
  // a coordinate pick among the peaks
  h.said.length = 0;
  h.onTravelToCoords(pick(PEAK.x, PEAK.y), WALKED);
  assert.deepEqual([h.said, h.talk], [[TRAVEL_VIEW_TEXT.mountains], []], 'OW-MOUNTAINS\' words, said once - never "You cannot travel there now." beside them');
  assert.equal(h.to.isTravelActive, false);
  // a coordinate pick on open ground: the Overworld's spot journey
  h.said.length = 0;
  h.onTravelToCoords(pick(505, 255), WALKED);
  assert.deepEqual(h.to.route.point.pixel, { x: 505, y: 255 }, 'the spot, routed (to its pixel round the peaks, then to it)');
  assert.deepEqual(h.to.route.legs.map((l) => [l.x, l.y, l.kind]), [[505, 255, 'open']], 'across the open ground: no road nearer');
  assert.deepEqual([h.to.destinationName, h.ui.destinationName], [null, TRAVEL_VIEW_TEXT.spot], 'a spot is no named journey, as the mod\'s own coordinate journey is not');
  h.tvJourneyUp();
  assert.deepEqual([h.said, h.talk, h.fast, h.view.state], [[], [], [], 'off'], 'nothing refused, and the view not raised');
  _resetModSettings();
});

test('TO-ROADS, both switches both ways (the host\'s own doors over the real settings store): First-Person Travel OFF is OW-ONLY exactly whatever the roads key says - the Overworld\'s route, the view risen with it and the journey stopped when the player brings it down; the classic skin keeps Travel Options exactly; the roads key is read LIVE', () => {
  for (const roads of [false, true]) {
    const ow = host({ roads });
    assert.deepEqual([ow.tvOwnsJourneys(), ow.tvRoutesJourneys()], [true, true], `First-Person Travel off (roads key ${roads ? 'on' : 'off'}): the Overworld\'s`);
    ow.onTravel(pick(510, 250), WALKED, { minutes: 90 });
    assert.deepEqual(ow.to.route?.legs.map(xy), [{ x: 500, y: 250 }, { x: 500, y: 245 }, { x: 510, y: 245 }, { x: 510, y: 250 }], 'the Overworld\'s route');
    ow.tvJourneyUp();
    assert.equal(ow.view.state, 'up', 'OW-ONLY: the view rises with it');
    ow.onLower('button');
    assert.deepEqual([ow.to.isTravelActive, ow.to.destinationName], [false, 'Ripwych'], 'brought down by the player: stopped through the panel, the place kept');
  }
  // the classic skin, both switches on: Travel Options exactly - the mod's own journey, straight
  const cl = host({ firstPerson: true, roads: true, enhanced: false });
  assert.deepEqual([cl.tvOwnsJourneys(), cl.tvRoutesJourneys()], [false, false], 'the classic skin keeps Travel Options exactly');
  cl.onTravel(pick(510, 250), WALKED, { minutes: 90 });
  assert.deepEqual([cl.to.route, cl.walk(), cl.said], [null, [{ x: 510, y: 250 }], []], 'the mod\'s own journey, at the place');
  // read live: flipped mid-game, the next pick answers the new way (AUDIT OW5 T1's law for its switch)
  const h = host({ firstPerson: true });
  assert.equal(h.tvRoutesJourneys(), false);
  setModSetting(TRAVEL_OPTIONS_VENDOR, KEY, true);
  assert.equal(h.tvRoutesJourneys(), true, 'turned on: routed at once');
  h.onTravel(pick(510, 250), WALKED, { minutes: 90 });
  assert.equal(h.to.route?.legs.length, 4, 'the very next pick is the route');
  setModSetting(TRAVEL_OPTIONS_VENDOR, KEY, false);
  assert.equal(h.tvRoutesJourneys(), false, 'and back');
  _resetModSettings();
});

test('TO-ROADS, THE ONE CONSTRUCTION SEAM, swept in the source: the planner is asked in the Overworld\'s own three functions and nowhere else in the host, the leg walker begun by its two journeys alone, the map\'s fork plans nothing of its own; and the view\'s own doors ask who OWNS the journey, never whether it is routed', () => {
  const spans = ['travelViewRouteTo', 'travelViewWalkTo', 'tvSeaNoWay'].map((n) => { const s = fnSource(n), a = WORLD.indexOf(s); return [n, a, a + s.length]; });
  const homeOf = (i) => spans.find(([, a, b]) => i >= a && i < b)?.[0] ?? null;
  const plans = [...WORLD.matchAll(/\bplanRoute\(/g)].map((m) => homeOf(m.index));
  assert.ok(plans.length >= 5, 'the planner\'s calls read');
  assert.deepEqual(plans.filter((n) => n === null), [], 'no second planner: every route the host plans is the Overworld\'s');
  assert.deepEqual([...WORLD.matchAll(/\.beginTravelAlongRoute\(|\.beginTravelToPoint\(/g)].map((m) => homeOf(m.index)), ['travelViewRouteTo', 'travelViewWalkTo'], 'no second leg walker');
  assert.match(fnSource('beginAcceleratedTravel'), /\n\s*if \(tvRoutesJourneys\(\)\) \{\n[\s\S]*?\n\s*return summary \? travelViewRouteTo\(summary, \{ roads: tvMapForcesRoads\(\) \}\) : false;[^\n]*\n[\s\S]*?\n\s*return travelViewWalkTo\(at, pick\.pixel, \{ roads: tvMapForcesRoads\(\) \}\);\n\s*\}\n/, 'the fork hands a place to travelViewRouteTo and a spot to travelViewWalkTo');
  for (const [what, src] of [['tvJourneyUp', fnSource('tvJourneyUp')], ['the view\'s onLower', ON_LOWER], ['travelViewGovern', fnSource('travelViewGovern')]]) {
    assert.ok(src.includes('tvOwnsJourneys()') && !src.includes('tvRoutesJourneys'), `${what} asks who owns the journey: a first-person route walks with the view left down`);
  }
});

test('TO-ROADS x OW-PATH: the Overworld\'s Path switch on FREE leaves First-Person Travel\'s roads the roads - the map\'s pick, a spot and the map\'s Resume all by the road, never pulled taut, nothing "fell back"; the Overworld\'s own journey is the switch\'s, across country (mutants: TO-ROADS-free-wins-the-pick, TO-ROADS-free-wins-the-spot, TO-ROADS-free-wins-the-resume, TO-ROADS-the-route-ignores-roads, TO-ROADS-the-walk-ignores-roads, TO-ROADS-a-forced-route-pulled-taut, TO-ROADS-forced-for-the-overworld-too)', () => {
  const legs = (h) => h.to.route.legs.map((l) => [l.x, l.y, l.kind]);
  // the Roads switch's own spot journey, the law a forced route keeps: the planner's grid, bends and all
  setTravelPathMode('roads');
  const ref = host();
  ref.onTravelToCoords(pick(507, 256), WALKED);
  const bent = legs(ref);
  assert.ok(bent.length > 1 && bent.every((l) => l[2] === 'open'), `a spot the roads do not help, bent on the grid: ${JSON.stringify(bent)}`);
  setTravelPathMode('free');
  try {
    assert.equal(travelPathUsesRoads(), false, 'the Overworld\'s bar says Free');
    const on = host({ firstPerson: true, roads: true });
    on.onTravel(pick(510, 250), WALKED, { minutes: 90 });
    assert.deepEqual(legs(on), [[500, 250, 'open'], [500, 245, 'road'], [510, 245, 'road'], [510, 250, 'road']], 'the named place by the road - the key is named for the roads, and the Path switch is the Overworld\'s bar\'s');
    assert.deepEqual(on.talk, [], 'never "no free way" - it never asked for one');
    on.enemies = true; on.frame(); on.enemies = false;
    on.stand(at(505, 245));
    on.travelViewResume();
    assert.deepEqual(legs(on), [[505, 245, 'open'], [510, 245, 'road'], [510, 250, 'road']], 'the map\'s Resume, by the road again - joined where the traveller stands (a FREE plan is one straight leg)');
    // a spot the roads do not help: walked as the Roads switch walks it - the grid's bend kept, never pulled taut
    const spot = host({ firstPerson: true, roads: true });
    spot.onTravelToCoords(pick(507, 256), WALKED);
    assert.deepEqual(legs(spot), bent, 'the spot by the Roads switch\'s law - its bends kept');
    // a spot the road DOES help: by the road, Free notwithstanding (a Free walk goes straight past it)
    const byRoad = host({ firstPerson: true, roads: true });
    byRoad.onTravelToCoords(pick(511, 245), WALKED);
    assert.ok(legs(byRoad).some((l) => l[2] === 'road'), `the spot by the road: ${JSON.stringify(legs(byRoad))}`);
    // the Overworld's own journey (First-Person Travel off) is the switch's: FREE, across country, the road never asked
    const ow = host();
    ow.onTravel(pick(510, 250), WALKED, { minutes: 90 });
    assert.deepEqual(legs(ow), [[510, 250, 'open']], 'the Overworld\'s journey: free, straight across, pulled taut');
    const owSpot = host();
    owSpot.onTravelToCoords(pick(507, 256), WALKED);
    assert.deepEqual(legs(owSpot), [[507, 256, 'open']], 'and its spot pulled taut');
    // and on ROADS, the two agree
    setTravelPathMode('roads');
    const same = host();
    same.onTravel(pick(510, 250), WALKED, { minutes: 90 });
    assert.deepEqual(legs(same), [[500, 250, 'open'], [500, 245, 'road'], [510, 245, 'road'], [510, 250, 'road']]);
  } finally {
    setTravelPathMode('roads');
    _resetModSettings();
  }
});
