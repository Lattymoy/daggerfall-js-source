// DRAGON6 (2026-10-29, the owner: "This should increase overworld travel speed, fly in the air and negate road travel";
// bible/11-Multiplayer/Dwarven-Dragon.md section 10): THE DRAGON'S JOURNEYS. On the travel map a tamed dragon's trip is
// twice a horse's pace and flown - every pixel the land's charge where nothing hinders it, the sea's and the peaks' alike,
// no ship and no fare. On the Overworld a journey begun on it is one straight leg of its own kind, run at the road's rate
// wherever it goes, never stopped at the sea, the dragon taken up and held at its cruise over what is under it, and set
// down at its end. tools/mutants/dragon6.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTravelTime, calculateTripCost, travelPixelMinutes, DRAGON_TRANSPORT_MODIFIER } from '../../../src/systems/travel/travel.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { dragonFlightPlan, cruiseHold, flownLeg, AIR_LEG_KIND, DRAGON_CRUISE_M, DRAGON_CRUISE_BAND_M } from '../../../src/systems/dragon/dragonJourney.js';
import { PlayerMotor, flyHold } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import { TRANSPORT_MODES } from '../../../src/systems/transport.js';
import { dragonAloft, dragonMounted, dragonCruising, setDragonCruise, dragonRideStep, _resetDragonFlight } from '../../../src/player/dragonRide.js';
import { createTravelOptions, readTravelOptionsSettings } from '../../../src/systems/travel/travelOptions.js';
import { mapPixelWorldOrigin } from '../../../src/systems/travel/travelPaths.js';
import { rectOf } from '../../../src/systems/travel/travelAutopilot.js';
import { TravelControlUI } from '../../../src/ui/travel/travelControlUI.js';
import { modSetting } from '../../../src/systems/modSettings.js';
import { TravelPopUpWindow } from '../../../src/ui/travel/travelPopUp.js';
import { newDragonMount } from '../../../src/systems/dragon/dragonMount.js';
import { hostText } from '../../hostText.mjs';

const LAND = CLIMATES.Woodlands, PEAK = CLIMATES.Mountain, SEA = CLIMATES.Ocean;
const line = (climate) => (x) => climate(x);

test('DRAGON6 the travel map: a dragon\'s trip is twice a horse\'s pace on the easiest ground, the sea and the peaks alike under it; no ship taken, no fare paid, no storm\'s sea - a horse\'s, a cart\'s and a walk\'s as DFU\'s (mutants: the sea priced; the peaks priced; the fare taken; the horse\'s pace)', () => {
  assert.equal(DRAGON_TRANSPORT_MODIFIER, 64, 'half the horse\'s 128');
  const flat = travelPixelMinutes(LAND, 128), flown = travelPixelMinutes(SEA, 64, { flying: true });
  assert.equal(travelPixelMinutes(LAND, 64, { flying: true }), flown, 'land and sea alike, flown');
  assert.equal(travelPixelMinutes(PEAK, 64, { flying: true }), flown, 'and the peaks');
  assert.ok(flat / flown >= 1.9 && flat / flown <= 2.2, `twice a horse on the easiest ground (${flat} against ${flown})`);
  const start = { x: 100, y: 100 }, end = { x: 160, y: 100 };
  const mixed = (x) => (x < 120 ? LAND : x < 140 ? SEA : PEAK);
  const at = (o) => calculateTravelTime(start, end, { sleepModeInn: true, speedCautious: true, ...o }, (x) => mixed(x));
  const horse = at({ hasHorse: true }), dragon = at({ hasHorse: true, hasDragon: true });
  assert.ok(dragon.minutes * 2 <= horse.minutes, `across land, sea and peaks, a dragon well inside half a horse's time (${dragon.minutes} against ${horse.minutes})`);
  assert.equal(at({ hasDragon: true, seaMult: 3 }).minutes, at({ hasDragon: true }).minutes, 'a storm\'s sea is no dragon\'s');
  assert.equal(at({ hasDragon: true, travelShip: true }).minutes, at({ hasDragon: true }).minutes, 'no ship taken');
  assert.equal(calculateTripCost(dragon.minutes, dragon.oceanPixels, { travelShip: true }).totalCost > calculateTripCost(dragon.minutes, dragon.oceanPixels, { travelShip: true, hasDragon: true }).totalCost, true, 'no fare paid');
  assert.deepEqual(at({ hasHorse: true }), horse, 'a horse\'s as it was');
  assert.equal(travelPixelMinutes(SEA, 128), (300 * 255) >> 8, 'a walk into the sea as DFU\'s');
});

test('DRAGON6 the travel popup prices a dragon owner\'s trip flown, read at OnPush as the transport trio is (mutants: the dragon unread)', () => {
  const entity = { items: [newDragonMount({ id: 'dg0123456789abcdef' })] };
  const deps = { getPlayerPixel: () => ({ x: 100, y: 100 }), getClimateIndex: () => SEA, gold: () => 9999, goldPieces: () => 9999, hasHorse: () => true, hasCart: () => false, hasShip: () => false, playerEntity: () => entity };
  const pop = new TravelPopUpWindow({ x: 160, y: 100 }, deps);
  assert.equal(pop.hasDragon, true);
  const horse = new TravelPopUpWindow({ x: 160, y: 100 }, { ...deps, playerEntity: () => ({ items: [] }) });
  pop.refresh?.(); horse.refresh?.();
  assert.ok(pop.travelTimeTotalMins > 0 && pop.travelTimeTotalMins * 2 <= horse.travelTimeTotalMins, `${pop.travelTimeTotalMins} against ${horse.travelTimeTotalMins}`);
});

test('DRAGON6 the flown plan: one straight leg of its own kind from the rider to the end, never a road\'s or the sea\'s; the governor climbs under its cruise and dives over it, in proportion within its band (mutants: the plan by the land; the governor upside down)', () => {
  assert.deepEqual(dragonFlightPlan({ x: 10, y: 20 }, { x: 40, y: 25 }), { pixels: [{ x: 10, y: 20 }, { x: 40, y: 25 }], cost: 30, kinds: [AIR_LEG_KIND] });
  assert.deepEqual(dragonFlightPlan({ x: 10, y: 20 }, { x: 10, y: 20 }).kinds, []);
  assert.equal(dragonFlightPlan(null, { x: 1, y: 1 }), null);
  assert.equal(flownLeg({ kind: AIR_LEG_KIND }), true);
  assert.equal(flownLeg({ kind: 'road' }), false);
  assert.equal(cruiseHold(0), 1, 'on the ground: a full climb');
  assert.equal(cruiseHold(DRAGON_CRUISE_M), 0, 'at its cruise: level');
  assert.equal(cruiseHold(DRAGON_CRUISE_M + DRAGON_CRUISE_BAND_M * 2), -1, 'far over it: a full dive');
  assert.ok(cruiseHold(DRAGON_CRUISE_M - DRAGON_CRUISE_BAND_M / 2) > 0 && cruiseHold(DRAGON_CRUISE_M - DRAGON_CRUISE_BAND_M / 2) < 1);
});

test('DRAGON6 the cruise on the motor: a flown journey takes the dragon up from the ground, holds it at its cruise over the land under it whatever the look\'s pitch, and its end brings it down to the ground, never dropped (mutants: the cruise never lifts; the hold unread; the end leaves it aloft)', () => {
  _resetDragonFlight();
  const ground = (x) => (x > 200 ? 30 : 0);   // a rise of 30 m ahead
  const m = new PlayerMotor(new Collider((x) => ground(x)));
  m.pos = [0, 0, 0]; m.grounded = true;
  m.setTransportMode(TRANSPORT_MODES.Dragon);
  const input = (o) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...o });
  const step = (n, o = {}, pitch = 0) => { for (let i = 0; i < n; i++) { m.levitating = dragonAloft(); m.update(1 / 30, input(o), Math.PI / 2, pitch); } };
  step(2);
  assert.equal(dragonMounted(), true);
  setDragonCruise(true);
  step(2);
  assert.equal(dragonAloft(), true, 'taken up');
  step(30 * 12, {}, -0.6);   // the look pitched down hard: the hold rules
  assert.ok(Math.abs(m.pos[1] - DRAGON_CRUISE_M) < 4, `held at its cruise (${m.pos[1].toFixed(1)} m)`);
  step(30 * 20, { forward: 1 });
  assert.ok(m.pos[0] > 200, `flown over the rise (x ${m.pos[0].toFixed(0)})`);
  assert.ok(Math.abs(m.pos[1] - (30 + DRAGON_CRUISE_M)) < 6, `held over the rise too (${m.pos[1].toFixed(1)} m)`);
  setDragonCruise(false);
  let worst = 0;
  for (let i = 0; i < 30 * 30 && dragonAloft(); i++) { step(1); worst = Math.max(worst, m.landedFallDistance || 0); }
  step(2); worst = Math.max(worst, m.landedFallDistance || 0);
  assert.equal(dragonAloft(), false, 'brought down at the journey\'s end');
  assert.equal(dragonCruising(), false);
  assert.equal(worst, 0, 'set down, never dropped');
  assert.equal(flyHold(), null, 'no hold once landed');
  _resetDragonFlight();
});

function travelRig() {
  const at = (px, py, dx = 16384, dz = 16384) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + dx, z: o.z + dz }; };
  const state = { pos: at(500, 250), pixel: { x: 500, y: 250 }, climate: LAND, rates: [] };
  const settings = readTravelOptionsSettings((vendor, key) => modSetting(vendor, key));
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 100 });
  const to = createTravelOptions({
    settings, ui, roads: () => null,
    worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false, localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => state.climate, entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => false, diseaseCount: () => 0, say: () => {}, messageBox: () => {},
    setTimeScale: (r) => state.rates.push(r), now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null, pushWindow: (w) => { w.show(); },
  });
  return { to, state, at, update: () => to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }) };
}

test('DRAGON6 the Overworld flown: a flown leg runs at the road\'s rate off any road and at the road\'s pace, over the sea without the ocean\'s stop, and asks the ride to cruise each frame it is walked; a walked leg over the sea is stopped as ever (mutants: the open ground\'s rate; the ocean stop; the cruise unasked)', () => {
  _resetDragonFlight();
  const m = new PlayerMotor(new Collider(() => 0));
  m.pos = [0, 0, 0]; m.grounded = true; m.setTransportMode(TRANSPORT_MODES.Dragon);
  dragonRideStep(1 / 30, m, {});   // the ride's last word: mounted
  const r = travelRig();
  const summary = { pixel: { x: 520, y: 250 }, name: 'Over the bay', mapId: 7 };
  assert.equal(r.to.beginTravelAlongRoute({ legs: [{ x: 520, y: 250, kind: AIR_LEG_KIND }], summary }, false, { quiet: true }), true);
  assert.equal(r.to.state.rateOnRoad, true, 'the road\'s rate, no road under it');
  r.state.climate = SEA;
  const out = r.update();
  assert.notEqual(out?.stopped, 'ocean', 'flown over the sea');
  assert.equal(dragonCruising(), true, 'the ride told to cruise');
  r.to.interruptTravel?.();
  r.update();
  assert.equal(dragonCruising(), false, 'its end brings it down');
  const w = travelRig();
  w.to.beginTravelAlongRoute({ legs: [{ x: 520, y: 250, kind: 'open' }], summary }, false, { quiet: true });
  assert.equal(w.to.state.rateOnRoad, false);
  w.state.climate = SEA;
  assert.equal(w.update()?.stopped, 'ocean', 'a walked leg stops at the sea');
  _resetDragonFlight();
});

test('DRAGON6 the Overworld\'s planners fly a rider on the dragon: no boat asked, the peaks never refused, the plan the straight flown one before any by the land (mutants: the land\'s plan on the dragon; the boat asked)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /let means = dragonMounted\(\) \? null : tvSeaMeans\(\);/);
  assert.match(w, /let plan = \(dragonMounted\(\) \? dragonFlightPlan\(from, summary\.pixel\) : null\) \?\? planRoute\(from, summary\.pixel,/);
  assert.match(w, /const means = dragonMounted\(\) \? null : tvSeaMeans\(\);/);
  assert.match(w, /if \(!door && !water && !dragonMounted\(\) && tvRouteGround\(\)\.peakAt\(pix\.x, pix\.y\)\)/);
  assert.match(w, /let plan = \(dragonMounted\(\) \? dragonFlightPlan\(from, pix\) : null\) \?\? planRoute\(from, pix,/);
});
