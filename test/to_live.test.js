// TO-LIVE (2026-10-02, Discord: "Whether or not I have the first setting for the Travel Options mod switched on or off,
// both cautious and reckless travel initiate time accelerated travel. The only way to use vanilla fast travel is to
// have the mod turned off entirely, and this requires a relog") - the mod's settings were read ONCE at the world's load,
// so the tile's "Cautiously" dial answered its boot value all session; and Inns, the other half of the mod's rule
// (TO-FIELD2 turned it on), was on no screen, so a trip stopping at inns - Recklessly's too - was always a journey. Now
// the live half is read again on every change of the mod settings (DFU re-runs LoadSettings on a change), the starred
// restart half carried from the load; Inns is on the tile beside Cautiously; the panel's Acceleration Limit followed its
// dial - RATE-LAW (2026-10-04, Mac: "Remove travel options dials") retired both the dial and the limit: a journey runs at
// its ground's rate. Each pin is red on the record's code (42e50765).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readTravelOptionsSettings, TRAVEL_OPTIONS_RESTART_KEYS, TRAVEL_OPTIONS_VENDOR } from '../src/systems/travelOptions.js';
import { modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { isPlayerControlledTravel } from '../src/ui/travelPopUp.js';
import { MOD_CURATED, modDials } from '../src/systems/features.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const CAUTIOUS = 'CautiousTravel.PlayerControlledCautiousTravel', INNS = 'StopAtInnsTravel.PlayerControlledInnsTravel';

test('TO-LIVE THE LIVE HALF READ AGAIN: handed the boot bag, the read answers the store as it stands now - Cautiously off, a cautious trip is DFU\'s fast travel at once - while the starred half (roads integration, the junction map and its placement, paid teleportation) stays the load\'s (mutants: the boot bag returned whole, the restart half read afresh)', () => {
  _resetModSettings();
  const boot = readTravelOptionsSettings();
  assert.equal(boot.cautiousTravel, true);
  const trip = { speedCautious: true, sleepModeInn: true, travelShip: false };
  assert.equal(isPlayerControlledTravel(boot, trip), true, 'the defaults: a journey');
  setModSetting(TRAVEL_OPTIONS_VENDOR, CAUTIOUS, false);
  setModSetting(TRAVEL_OPTIONS_VENDOR, INNS, false);
  setModSetting(TRAVEL_OPTIONS_VENDOR, 'RoadsIntegration.Enable', !boot.roadsIntegration);
  setModSetting(TRAVEL_OPTIONS_VENDOR, 'Teleportation.EnablePaidTeleportation', !boot.teleportCost);
  setModSetting(TRAVEL_OPTIONS_VENDOR, 'RoadsJunctionMap.ScreenSize', (modSetting(TRAVEL_OPTIONS_VENDOR, 'RoadsJunctionMap.ScreenSize') | 0) + 1);
  const live = readTravelOptionsSettings(modSetting, boot);
  assert.deepEqual([live.cautiousTravel, live.stopAtInnsTravel], [false, false], 'the live half: as the store stands');
  assert.equal(live.accelerationLimit, undefined, 'RATE-LAW: no limit dial is read');
  assert.equal(isPlayerControlledTravel(live, trip), false, 'Cautiously off: DFU\'s fast travel, no reload');
  assert.equal(isPlayerControlledTravel(live, { ...trip, speedCautious: false }), false, 'Recklessly at inns, Inns off: fast travel');
  assert.equal(isPlayerControlledTravel(live, { ...trip, speedCautious: false, sleepModeInn: false }), true, 'Recklessly camping out: the mod\'s journey still (its readme :11)');
  for (const k of TRAVEL_OPTIONS_RESTART_KEYS) assert.deepEqual(live[k], boot[k], `${k}: the load's`);
  assert.ok(TRAVEL_OPTIONS_RESTART_KEYS.includes('roadsIntegration') && TRAVEL_OPTIONS_RESTART_KEYS.includes('teleportCost') && TRAVEL_OPTIONS_RESTART_KEYS.includes('junctionMapSize'));
  assert.ok(!TRAVEL_OPTIONS_RESTART_KEYS.includes('cautiousTravel') && !TRAVEL_OPTIONS_RESTART_KEYS.includes('stopAtInnsTravel'));
  assert.ok(Object.isFrozen(live));
  const fresh = readTravelOptionsSettings();
  assert.notEqual(fresh.roadsIntegration, boot.roadsIntegration, 'read with no boot bag, the store whole (the record\'s read)');
  _resetModSettings();
});

test('TO-LIVE THE HOST READS IT AGAIN: the world keeps its load\'s bag and, on a change of the mod settings, reads the live half afresh and hands it to the mod - at the map\'s open (the fare deps\' handle) and in the journey\'s own frame; RATE-LAW: no limit to hand the panel (mutants: never refreshed, refreshed but not handed over)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /let travelOptionsSettings = readTravelOptionsSettings\(\);/);
  assert.match(w, /const travelOptionsBoot = travelOptionsSettings;/);
  const fn = w.match(/function refreshTravelOptionsSettings\(\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
  assert.match(fn, /const g = modSettingsGeneration\(\);\s+if \(g === _travelOptionsGen\) return;\s+_travelOptionsGen = g;/);
  assert.match(fn, /travelOptionsSettings = readTravelOptionsSettings\(modSetting, travelOptionsBoot\);/);
  assert.match(fn, /if \(travelOptions\) travelOptions\.settings = travelOptionsSettings;/);
  assert.doesNotMatch(fn, /setAccelerationLimit/, 'RATE-LAW: the panel has no limit');
  assert.match(w, /travelOptions: \(\) => \{ refreshTravelOptionsSettings\(\); return travelOptions; \},/, 'the maps\' handle');
  assert.match(w, /refreshTravelOptionsSettings\(\);[^\n]*\n\s+const report = travelOptions\.update\(\{/, 'the journey\'s frame');
});

test('TO-LIVE INNS ON THE TILE: the other half of the mod\'s rule is a dial the drawer draws, right after Cautiously - TO-FIELD2 turned it on and no screen could turn it off (mutant: off the tile)', () => {
  const tile = MOD_CURATED['travel-options'];
  assert.equal(tile.indexOf(INNS), tile.indexOf(CAUTIOUS) + 1);
  assert.ok(modDials('travel-options').includes(INNS), 'reachable');
});

test('TO-LIVE x RATE-LAW: THE LIMIT DIAL IS GONE - off the tile and out of the declared keys; the tile keeps Cautiously, Inns, the ports rule, the location pause and the port\'s own switches (mutant: the dial back on the tile)', () => {
  const tile = MOD_CURATED['travel-options'];
  assert.ok(!tile.includes('TimeAcceleration.AccelerationLimit'), 'not on the tile');
  assert.ok(!modDials('travel-options').some((k) => k.startsWith('TimeAcceleration.')), 'and no TimeAcceleration key reaches the drawer');
  assert.deepEqual([...tile], [CAUTIOUS, INNS, 'ShipTravel.OnlyFromPorts', 'GeneralOptions.LocationPause', 'GeneralOptions.AvoidObstacles',
    'GeneralOptions.FirstPersonTravel', 'GeneralOptions.FirstPersonTravelFollowsRoads']);
});
