// TRAVEL-ONLINE (2026-10-03, Mac: "Remove instant travel online"). Online, Daggerfall's fast travel is a teleport - it
// arrives at the world's present, with no world time to spend (OL2, LIVED1) - and TO-ONLINE (2026-09-19, Mac: "travel
// options uses instant travel for the online mod, which shouldn't be the case") had left three switches that reached
// it: Travel Options off, and either of the two dials that send a Cautious or an Inns trip down the journey (TO-LIVE put
// both on the tile). All three are the room's now (systems/online/onlineLane.js ONLINE_ROOM_MOD_KEYS): online a land trip is
// travelled whatever the player's own store says; offline every switch is still theirs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readTravelOptionsSettings, TRAVEL_OPTIONS_VENDOR } from '../../../src/systems/travel/travelOptions.js';
import { modSetting, setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';
import { ONLINE_ROOM_MOD_KEYS, ONLINE_PLAYERS_OWN_MODS, ONLINE_LAND_TRAVEL_REFUSAL } from '../../../src/systems/online/onlineLane.js';
import { isPlayerControlledTravel, enforceShipRestriction } from '../../../src/ui/travel/travelPopUp.js';

const CAUTIOUS = 'CautiousTravel.PlayerControlledCautiousTravel', INNS = 'StopAtInnsTravel.PlayerControlledInnsTravel', PORTS = 'ShipTravel.OnlyFromPorts';
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
function online(fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  globalThis.location = { search: '?online=1' };
  try { return fn(); } finally { if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location; }
}
/** What the travel map does with a land trip: the popup's word (the mod's settings, or null with the mod off - world.js
 *  builds no Travel Options then), for each of the popup's four speed and night choices. */
const landTrips = () => {
  const settings = modSetting(TRAVEL_OPTIONS_VENDOR, 'Enabled') ? readTravelOptionsSettings(modSetting) : null;
  return [[true, true], [true, false], [false, true], [false, false]].map(([speedCautious, sleepModeInn]) =>
    isPlayerControlledTravel(settings, { speedCautious, sleepModeInn, travelShip: false }));
};

test('TRAVEL-ONLINE: online every land trip is travelled, whatever the player turned off - the mod, Cautiously, Inns; offline the same switches still give Daggerfall\'s fast travel (mutants: each of the three keys)', () => {
  _resetModSettings();
  try {
    assert.deepEqual({ ...ONLINE_ROOM_MOD_KEYS[TRAVEL_OPTIONS_VENDOR] }, { Enabled: true, [CAUTIOUS]: true, [INNS]: true, [PORTS]: true });
    assert.ok(!ONLINE_PLAYERS_OWN_MODS.includes(TRAVEL_OPTIONS_VENDOR), 'no longer every switch the player\'s');
    for (const [key, value] of [[CAUTIOUS, false], [INNS, false], ['Enabled', false]]) {
      setModSetting(TRAVEL_OPTIONS_VENDOR, key, value);
      assert.deepEqual(online(landTrips), [true, true, true, true], `online, ${key} off in the player's store: still travelled`);
    }
    // offline the store is the player's: the mod off is fast travel for every trip...
    assert.deepEqual(landTrips(), [false, false, false, false], 'offline, the mod off: fast travel');
    setModSetting(TRAVEL_OPTIONS_VENDOR, 'Enabled', true);
    // ...and with both dials off, a Cautious or an Inns trip is fast travel (TO-LIVE's own rule, untouched)
    assert.deepEqual(landTrips(), [false, false, false, true], 'offline, both dials off: only a Reckless camping trip is travelled');
    // a ship is fast travel online and off: the mod has no voyage, and the islands are reached no other way
    assert.equal(online(() => isPlayerControlledTravel(readTravelOptionsSettings(modSetting), { speedCautious: true, sleepModeInn: false, travelShip: true })), false);
  } finally { _resetModSettings(); }
});

test('TRAVEL-ONLINE by source: the world loads the mod through modSetting (the room\'s value online), and the Mods pane locks the three with travel\'s own words', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const travelOptionsOn = modSetting\(TRAVEL_OPTIONS_VENDOR, 'Enabled'\);/);
  assert.match(w, /travelOptions = travelOptionsOn \? createTravelOptions\(\{/);
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /const ONLINE_TRAVEL_VENDORS = Object\.freeze\(\['travel-options'\]\);/);
  assert.match(menu, /const ONLINE_TRAVEL_NOTE = 'On for everyone online: every trip over land is traveled, and ships sail only from ports\.[^']*';/);
  assert.match(menu, /Travel Options is on for everyone, so every trip over land is traveled and ships sail only from ports\./, 'the pane\'s own line names it');
  // AUDIT TRAVEL-ONLINE T7: the floor under the switches - online a trip over land never reaches fast travel's teleport
  // AUDIT IT1 W3: a driver's trip never meets this floor - openImmersiveMap's own onTravel calls fastTravelTo
  assert.match(w, /if \(isOnlinePage\(\) && !opts\?\.travelShip\) \{ townTalk\.say\(ONLINE_LAND_TRAVEL_REFUSAL\); hudFade\.clearFade\(\); \} else fastTravelTo\(pick, opts, computed\);/);
  assert.equal(ONLINE_LAND_TRAVEL_REFUSAL, 'Online, journeys over land cannot be skipped. Turn on Travel Options and try again.');
});

test('TRAVEL-ONLINE (AUDIT T1): the ports rule is the room\'s too - with it off in the player\'s store, a trip from the wilderness to an inland place on the ship toggle (on by default) stays a ship, and a ship is never walked: the teleport; online the rule holds, the ship is knocked off and the trip is walked (mutant: the ports key)', () => {
  _resetModSettings();
  try {
    setModSetting(TRAVEL_OPTIONS_VENDOR, PORTS, false);
    const wilds = { currentLocationMapId: null, isOnShip: false, destinationMapId: null, oceanPixels: 0 };
    const trip = () => {
      const settings = readTravelOptionsSettings(modSetting);
      const opts = enforceShipRestriction(settings, { speedCautious: true, sleepModeInn: true, travelShip: true }, wilds);
      return [opts.travelShip, isPlayerControlledTravel(settings, opts)];
    };
    assert.deepEqual(trip(), [true, false], 'offline, the rule off: a ship from the wilderness - fast travel');
    assert.deepEqual(online(trip), [false, true], 'online: no port here, so no ship - and the trip is walked');
  } finally { _resetModSettings(); }
});
