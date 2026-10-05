// OW-TOGGLE (2026-09-28, Mac: "bring back the original travel option as a toggle. Off by default." - "Travel Options
// was changed. The normal first person travel accelerated was removed in favor of the overworld travel") - FIRST-PERSON
// TRAVEL, A SWITCH. OW-ONLY made every walked trip on the enhanced interface the Overworld's; the port's own key on
// Travel Options' pane (`GeneralOptions.FirstPersonTravel`, OFF) gives the first-person journey back. On, a pick on the
// map begins Travel Options' own journey on the ground, the map's Resume is the mod's, the view does not rise with a
// journey and coming down does not stop one - Travel Options as it was before OW-ONLY. Off, OW-ONLY exactly.
//
// Pinned here: the key (declared, off, a toggle, the port's own words, on the tile), and the world host's doors MOUNTED
// from their own source over a fake host and the real settings store - tvOwnsJourneys (read live: AUDIT OW5 T1),
// beginAcceleratedTravel, travelViewResume (a route re-planned either way: AUDIT OW5 J1), tvJourneyUp and the view's
// onLower - both ways; and the governor both ways.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { MOD_CURATED, modDials } from '../src/systems/features.js';
import { TRAVEL_OPTIONS_VENDOR } from '../src/systems/travelOptions.js';
import { travelWalkRate, TV_MOVE_ACTIONS } from '../src/scenes/travelView.js';
import { createLoadGovernor, unbuiltAround } from '../src/systems/travelGovernor.js';
import { foePaced } from '../src/systems/travelThreat.js';   // RATE-LAW: ENEMY-PACE's fixed floor, which the governor calls
import { timeScale, setTimeScale, resetTimeScale, MAX_TIME_SCALE } from '../src/systems/timeScale.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const KEY = 'GeneralOptions.FirstPersonTravel';

test('OW-TOGGLE THE SWITCH: the port\'s own key on Travel Options\' pane - OFF by default, a toggle, saying it is the port\'s and takes effect at once, on the tile; the vendored modsettings.json does not carry it', () => {
  const def = MOD_SETTINGS['travel-options'].keys[KEY];
  assert.ok(def, 'declared');
  assert.equal(def.default, false, 'OFF - the Overworld\'s journeys stay the default (Mac: "Off by default")');
  assert.equal(typeof def.default, 'boolean', 'a toggle');
  assert.match(def.description, /first person/);
  assert.match(def.description, /Takes effect at once\./, 'AUDIT OW5 T1: read live - the tile\'s "when the world next loads" is the mod\'s other keys\'');
  assert.match(def.description, /port’s own switch - the mod has none/);
  const shipped = JSON.parse(read('vendor/travel-options/modsettings.json'));
  assert.ok(!shipped.Sections.flatMap((s) => s.Keys.map((k) => `${s.Name}.${k.Name}`)).includes(KEY), 'the author\'s file is untouched');
  assert.ok(MOD_CURATED['travel-options'].includes(KEY) && modDials('travel-options').includes(KEY), 'reachable: on the tile');
  _resetModSettings();
  assert.equal(modSetting(TRAVEL_OPTIONS_VENDOR, KEY), false, 'the shipped store: off');
});

/** One of world.js's own functions, by name: a one-line declaration, or up to its closing brace at the host's indent. */
function fnSource(name) {
  const at = WORLD.indexOf(`  function ${name}(`);
  assert.ok(at >= 0, `world.js declares ${name}`);
  const eol = WORLD.indexOf('\n', at);
  if (WORLD.slice(at, eol).trimEnd().endsWith('}')) return WORLD.slice(at, eol);
  return WORLD.slice(at, WORLD.indexOf('\n  }\n', at) + 4);
}
/** the view's onLower dep, as the host hands it to createTravelView */
function onLowerSource() {
  const m = WORLD.match(/\n\s*onLower: (\(why\) => \{[^\n]*\}),\n/);
  assert.ok(m, 'the host\'s onLower');
  return m[1];
}

/** The host's journey doors, mounted over a fake host and the REAL settings store. `firstPerson` is the switch. */
function rig({ firstPerson = false, enhanced = true } = {}) {
  _resetModSettings();
  if (firstPerson) setModSetting(TRAVEL_OPTIONS_VENDOR, KEY, true);
  const calls = [];
  const view = { state: 'off', enter() { calls.push('view up'); view.state = 'up'; } };
  const travelOptions = {
    isTravelActive: false,
    state: { autopilot: null },
    route: null,
    beginTravel: (dest, cautious, est) => { calls.push(['beginTravel', dest.name, cautious, est]); },
    beginTravelToCoords: (pixel, cautious) => { calls.push(['beginTravelToCoords', pixel.x, pixel.y, cautious]); },
    resumeTravel: () => calls.push('resumeTravel'),
    messages: { pauseTravel: () => calls.push('pauseTravel') },
  };
  const env = {
    travelOptions, travelView: view, isEnhanced: () => enhanced, modSetting, TRAVEL_OPTIONS_VENDOR,
    travelViewAllowed: () => ({ ok: true }), travelViewCanGo: () => true,
    tvPlaceSummary: (x, y) => ({ pixel: { x, y }, name: 'Daggerfall' }),
    travelViewRouteTo: (s) => { calls.push(['travelViewRouteTo', s.name]); return true; },
    travelViewWalkTo: (at, pixel) => { calls.push(['travelViewWalkTo', pixel.x, pixel.y]); return true; },
    townTalk: { say: (t) => calls.push(['say', t]) },
    mapPixelToWorldCoords: (x, y) => ({ x: x * 32768, z: y * 32768 }), tvSceneOf: (x, z) => [x, 10, z],
    tvWater: () => false, tvSeaY: () => 0, TV_SEA_EPS_M: 0.5, TRAVEL_VIEW_TEXT: { water: 'water' },
    locationIndex: new Map(), locationWorldRect: () => null,
    gamePaused: () => false, modes: { modalWindowUp: () => false }, duelEnemyNear: () => false,
    areEnemiesNearby: () => false, exteriorFoePool: () => [],
  };
  const names = Object.keys(env);
  // PIN MOVED (TO-ROADS): the map's fork asks tvRoutesJourneys (First-Person Travel's roads key, off in this store) -
  // mounted beside the owner it grows from (test/fb0929d_toroads.test.js runs the roads key both ways)
  const body = [fnSource('tvOwnsJourneys'), fnSource('tvRoutesJourneys'), fnSource('tvMapForcesRoads'), fnSource('travelViewResume'), fnSource('beginAcceleratedTravel'), fnSource('tvJourneyUp'),
    `const onLower = ${onLowerSource()};`,
    'return { tvOwnsJourneys, travelViewResume, beginAcceleratedTravel, tvJourneyUp, onLower };'].join('\n');
  const host = new Function(...names, body)(...names.map((k) => env[k]));
  return { host, calls, view, travelOptions };
}

const PICK = { pixel: { x: 207, y: 213 }, name: 'Daggerfall', mapId: 1, regionIndex: 17, locationIndex: 3 };

test('OW-TOGGLE host, OFF (the default): OW-ONLY exactly - the map\'s pick is the Overworld\'s journey, the view rises with it, and brought down it stops', () => {
  const { host, calls, view, travelOptions } = rig();
  assert.equal(host.tvOwnsJourneys(), true, 'the Overworld owns the walked trip');
  assert.equal(host.beginAcceleratedTravel(PICK, { speedCautious: false }, { estimateMinutes: 90 }), true);
  assert.deepEqual(calls, [['travelViewRouteTo', 'Daggerfall']], 'a place: by the roads, in the view - never the mod\'s ground journey');
  calls.length = 0;
  travelOptions.isTravelActive = true; travelOptions.state.autopilot = {};
  host.tvJourneyUp();
  assert.deepEqual(calls, ['view up'], 'a walking journey raises the view');
  calls.length = 0;
  host.onLower('button');
  assert.deepEqual(calls, ['pauseTravel'], 'brought down by the player: the journey stops');
  view.state = 'off';
  assert.equal(rig({ enhanced: false }).host.tvOwnsJourneys(), false, 'the classic skin keeps Travel Options exactly');
  _resetModSettings();
});

test('OW-TOGGLE host, ON: Travel Options\' own first-person journey - begun on the ground from the map, resumed by the mod, the view left where the player put it, and coming down stops nothing', () => {
  const { host, calls, view, travelOptions } = rig({ firstPerson: true });
  assert.equal(host.tvOwnsJourneys(), false, 'the switch: the Overworld owns no journey');
  assert.equal(host.beginAcceleratedTravel(PICK, { speedCautious: true }, { estimateMinutes: 90 }), true);
  assert.deepEqual(calls, [['beginTravel', 'Daggerfall', true, 90]], 'a place: the mod\'s own journey, cautious as asked, the popup\'s estimate along');
  calls.length = 0;
  assert.equal(host.beginAcceleratedTravel(PICK, { speedCautious: false }, { coords: true }), true);
  assert.deepEqual(calls, [['beginTravelToCoords', 207, 213, false]], 'a spot: the mod\'s own');
  calls.length = 0;
  host.travelViewResume();
  assert.deepEqual(calls, ['resumeTravel'], 'the map\'s Resume of the mod\'s journey (a map pick has no route) is the mod\'s');
  calls.length = 0;
  travelOptions.route = { summary: { name: 'Wayrest' } };
  host.travelViewResume();
  assert.deepEqual(calls, [['travelViewRouteTo', 'Wayrest']], 'AUDIT OW5 J1: a route the Overworld planned (the view raised by hand) is planned again from here - never walked straight over the peaks');
  travelOptions.route = null;
  calls.length = 0;
  travelOptions.isTravelActive = true; travelOptions.state.autopilot = {};
  host.tvJourneyUp();
  assert.equal(view.state, 'off', 'a journey walking: the view is not raised');
  view.state = 'up';
  host.onLower('button'); host.onLower('escape'); host.onLower('key');
  assert.deepEqual(calls, [], 'the view brought down: the journey walks on, on the ground');
  _resetModSettings();
});

test('OW-TOGGLE host: the switch is read LIVE - flipped mid-game, the next ask answers the new way (AUDIT OW5 T1: read at boot, a save loaded in play kept the old answer)', () => {
  const { host } = rig();
  assert.equal(host.tvOwnsJourneys(), true, 'off: the Overworld\'s');
  setModSetting(TRAVEL_OPTIONS_VENDOR, KEY, true);
  assert.equal(host.tvOwnsJourneys(), false, 'flipped on: first person, at once');
  setModSetting(TRAVEL_OPTIONS_VENDOR, KEY, false);
  assert.equal(host.tvOwnsJourneys(), true, 'and back');
  _resetModSettings();
});

/** world.js's governor, mounted from its own source (as test/tv_wasd.test.js mounts it): `let tvHeld` through travelViewGovern. */
function mountGovernor(env) {
  const from = WORLD.indexOf('  let tvHeld = null;');   // RATE-LAW: ENEMY-PACE's stepper rate is gone - its floor is travelThreat.js foePaced
  const fn = WORLD.indexOf('  function travelViewGovern(dt) {', from);
  const end = WORLD.indexOf('\n  }\n', fn) + 4;
  assert.ok(from >= 0 && fn > from && end > fn, 'the governor\'s source');
  const names = Object.keys(env);
  return new Function(...names, `${WORLD.slice(from, end)}\nreturn { govern: travelViewGovern, held: () => tvHeld, ground: () => tvHeldWhy === 'ground' };`)(...names.map((k) => env[k]));   // AUDIT OW5 G1's word, OW6's reason
}

test('OW-TOGGLE host: a first-person journey under a view brought down runs at the speed asked - AUDIT OW4 J5\'s x1 hold is the Overworld\'s journey\'s alone', () => {
  for (const [owns, want] of [[true, 1], [false, 20]]) {
    resetTimeScale();
    setTimeScale(20);   // the journey's own ask, set by the mod's panel
    const g = mountGovernor({
      travelControlUI: { isShowing: true },   // RATE-LAW: no spinner, no limit - the journey's ask is travelAsked below
      foePaced, travellerOnRoad: () => false,
      travelOptions: { state: { autopilot: {} } },
      travelWalkRate, TV_MOVE_ACTIONS,
      travelView: { active: false, state: 'off' },   // brought down
      held: () => false, keys: new Set(), walkMode: true, playerSpawned: true, player: { isPlayerSwimming: false },
      csaBoatUnderMe: () => null, gamePaused: () => false,
      setWorldTimeScale: setTimeScale, worldTimeScale: timeScale, resetTimeScale,
      travelAsked: 20, csaHoldsTimeScale: () => false, travelGovernor: createLoadGovernor({ max: MAX_TIME_SCALE }),
      state: { terrainDistance: 3 }, playerTravelPixel: () => ({ x: 100, y: 200 }), tvGroundGenNow: () => 0,
      unbuiltAround, built: { has: () => true },
      tvOwnsJourneys: () => owns,
      journeyThreatCap: () => ({ cap: Infinity }), journeySlowSaid: () => {},   // OW6: no enemy about (test/ow6_slowdown.test.js runs the cap)
    });
    g.govern(1 / 60);
    assert.equal(timeScale(), want, owns ? 'the Overworld\'s journey on the ground: held at x1 until the view rises' : 'First-Person Travel: the journey\'s own x20, on the ground');
    assert.equal(g.held(), owns ? 1 : null, owns ? 'and the panel told it is held' : 'and nothing held');
    assert.equal(g.ground(), owns, owns ? 'AUDIT OW5 G1: held for the ground - the bar says "until the Overworld rises", never the load' : 'no hold, no reason');
  }
  resetTimeScale();
});

test('OW-TOGGLE host: one question - tvOwnsJourneys reads the switch from the store itself, never the boot\'s settings bag', () => {
  assert.match(WORLD, /function tvOwnsJourneys\(\) \{ return !!travelOptions && !modSetting\(TRAVEL_OPTIONS_VENDOR, 'GeneralOptions\.FirstPersonTravel'\) && isEnhanced\(\) && !!travelView; \}/);
  assert.ok(!/firstPersonTravel/.test(read('src/systems/travelOptions.js')), 'the bag carries no copy to go stale');
});
