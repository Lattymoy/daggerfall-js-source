// F-slice: FAST TRAVEL laws. TravelTimeCalculator.cs verbatim +
// DaggerfallTravelPopUp's arrival clamps. Synthetic climate grids
// carry the exact fixed-point arithmetic; the real CLIMATE.PAK run
// pins the cross-law consistencies on a known route.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  calculateTravelTime, calculateTripCost, arrivalClampMinutes, travelDays,
  CLIMATE_INDICES, TERRAIN_MOVEMENT_MODIFIERS,
} from '../src/systems/travel.js';
import { CLIMATES, MapsFile } from '../src/formats/mapsFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set - real-data validation skipped' : false;

const flat = (climate) => () => climate;

test('travel: the fixed-point chain, exact - woodlands/mountain/ocean, foot/horse/cart, inn/camp', () => {
  // Woodlands 231 -> index 5 -> modifier 250:
  // ((102*256)>>8) * (256-250+256) >> 8 = (102*262)>>8 = 104; camping
  // multiplies (300*104)>>8 = 121. Ten pixels east, cautious.
  const wood = calculateTravelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, { speedCautious: true }, flat(CLIMATES.Woodlands));
  assert.equal(wood.minutes, 1210);
  assert.equal(wood.oceanPixels, 0);
  // the inn skips the 300/256 camp multiplier - resting in beds is FASTER
  assert.equal(calculateTravelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, { speedCautious: true, sleepModeInn: true }, flat(CLIMATES.Woodlands)).minutes, 1040);
  // reckless is exactly the >>1 of the cautious total
  assert.equal(calculateTravelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, {}, flat(CLIMATES.Woodlands)).minutes, 605);
  // a horse (128): (102*128)>>8 = 51; 51*262>>8 = 52; camp -> 60/move
  assert.equal(calculateTravelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, { speedCautious: true, hasHorse: true }, flat(CLIMATES.Woodlands)).minutes, 600);
  // a cart (192): (102*192)>>8 = 76; 76*262>>8 = 77; camp -> 90/move
  assert.equal(calculateTravelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, { speedCautious: true, hasCart: true }, flat(CLIMATES.Woodlands)).minutes, 900);
  // Mountain 226: offset 3 -> CLIMATE_INDICES[3] = 1 -> modifier 220:
  // 102*(256-220+256)>>8 = 116; camp (300*116)>>8 = 135
  assert.equal(calculateTravelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, { speedCautious: true }, flat(CLIMATES.Mountain)).minutes, 1350);
  // Ocean: ship 51/move (camp (300*51)>>8 = 59), shipless 255 (camp 298)
  const sea = calculateTravelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, { speedCautious: true, travelShip: true }, flat(CLIMATES.Ocean));
  assert.equal(sea.minutes, 590);
  assert.equal(sea.oceanPixels, 10);
  assert.equal(calculateTravelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, { speedCautious: true }, flat(CLIMATES.Ocean)).minutes, 2980);
  // the classic diagonal stepper: 10 east 4 north walks exactly 10 moves
  const diag = calculateTravelTime({ x: 0, y: 0 }, { x: 10, y: 4 }, { speedCautious: true }, flat(CLIMATES.Woodlands));
  assert.equal(diag.minutes, 1210, 'furthest-axis moves only');
  assert.equal(CLIMATE_INDICES.length, 10);
  assert.equal(TERRAIN_MOVEMENT_MODIFIERS.length, 6);
});

test('travel: the trip cost - inn nights guarded at zero, the ship rental bands', () => {
  // 1210 minutes -> 21 hours; inn, no ocean: 5*trunc(21/24)=0, +5 = 5
  assert.deepEqual(calculateTripCost(1210, 0, { sleepModeInn: true }), { piecesCost: 5, totalCost: 5 });
  // 6 days of land -> 8640 min -> 144h: 5*6 + 5 = 35
  assert.deepEqual(calculateTripCost(8640, 0, { sleepModeInn: true }), { piecesCost: 35, totalCost: 35 });
  // DFU's negative guard: 30 ocean hours against 10 land hours
  assert.deepEqual(calculateTripCost(600, 30, { sleepModeInn: true }), { piecesCost: 5, totalCost: 5 });
  // camping costs nothing on land
  assert.deepEqual(calculateTripCost(8640, 0, {}), { piecesCost: 0, totalCost: 0 });
  // a rented ship: 25 per started 24 ocean pixels
  assert.equal(calculateTripCost(1000, 30, { travelShip: true }).totalCost, 50);
  assert.equal(calculateTripCost(1000, 23, { travelShip: true }).totalCost, 25);
  // owning the ship zeroes the rental; the free-rooms perk zeroes the inn
  assert.equal(calculateTripCost(1000, 30, { travelShip: true, hasShip: true }).totalCost, 0);
  assert.equal(calculateTripCost(8640, 0, { sleepModeInn: true, freeTavernRooms: true }).totalCost, 0);
});

test('travel: the arrival clamps - cautious lands at 7:10, the sun-averse at dusk', () => {
  const at = (h, m) => h * 60 + m;   // day 0 minutes
  // night arrivals push to 7:10 the same morning
  assert.equal(arrivalClampMinutes(at(3, 20), { speedCautious: true }), 230);   // 3:20 + 230 = 7:10
  assert.equal(arrivalClampMinutes(at(7, 5), { speedCautious: true }), 5);      // 7:05 -> 7:10
  assert.equal(arrivalClampMinutes(at(7, 10), { speedCautious: true }), 0);     // on the line: no clamp
  // evening arrivals push to 7:10 NEXT day (the 31-hour form)
  assert.equal(arrivalClampMinutes(at(20, 0), { speedCautious: true }), 670);   // 20:00 + 670 = 31:10
  assert.equal(arrivalClampMinutes(at(12, 0), { speedCautious: true }), 0);     // daytime: untouched
  // reckless never clamps
  assert.equal(arrivalClampMinutes(at(3, 20), {}), 0);
  // the sun-averse arm wins over everything: day pushes to dusk, hour whole
  assert.equal(arrivalClampMinutes(at(12, 30), { sunAverse: true }), 360);      // 12:30 -> 18:30
  assert.equal(arrivalClampMinutes(at(6, 0), { sunAverse: true, speedCautious: true }), 720);
  assert.equal(arrivalClampMinutes(at(20, 0), { sunAverse: true, speedCautious: true }), 0, 'night: no clamp, cautious ignored');
  // the day display rounds up
  assert.equal(travelDays(1210), 1);
  assert.equal(travelDays(1441), 2);
});

test('travel: the real map - Daggerfall to Wayrest obeys the cross-law order', { skip: skipReal }, () => {
  const maps = new MapsFile();
  maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))),
    new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))),
    new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  const find = (regionName, locName) => {
    for (let r = 0; r < maps.regionCount; r++) {
      const region = maps.getRegion(r);
      if (!region || region.name !== regionName) continue;
      for (let l = 0; l < region.locationCount; l++) {
        const loc = maps.getLocation(r, l);
        if (loc?.name === locName) {
          const lon = loc.mapTableData.longitude, lat = loc.mapTableData.latitude;
          return { x: Math.trunc(lon / 128), y: 499 - Math.trunc(lat / 128) };
        }
      }
    }
    throw new Error(`${regionName}/${locName} not found`);
  };
  const dag = find('Daggerfall', 'Daggerfall');
  const way = find('Wayrest', 'Wayrest');
  const clim = (x, y) => maps.getClimateIndex(x, y);
  const foot = calculateTravelTime(dag, way, { speedCautious: true }, clim);
  const ship = calculateTravelTime(dag, way, { speedCautious: true, travelShip: true }, clim);
  const horse = calculateTravelTime(dag, way, { speedCautious: true, hasHorse: true }, clim);
  const reckless = calculateTravelTime(dag, way, {}, clim);
  assert.ok(foot.minutes > 0);
  assert.ok(foot.oceanPixels > 0, 'the straight line crosses the Iliac');
  assert.equal(ship.oceanPixels, foot.oceanPixels, 'the path does not depend on the mode');
  assert.ok(ship.minutes < foot.minutes, 'a ship beats swimming the bay');
  assert.ok(horse.minutes < foot.minutes, 'a horse beats walking');
  assert.equal(reckless.minutes, foot.minutes >> 1, 'reckless is exactly the halving');
  // ~650 pixels across the bay: the SLOWEST mode (cautious + camp +
  // no ship) is months, the FASTEST (reckless + inn + ship) is weeks
  // - bands, not golden numbers.
  assert.ok(travelDays(foot.minutes) >= 30 && travelDays(foot.minutes) <= 200, `slowest days ${travelDays(foot.minutes)}`);
  const fastest = calculateTravelTime(dag, way, { sleepModeInn: true, travelShip: true, hasHorse: true }, clim);
  assert.ok(travelDays(fastest.minutes) >= 5 && travelDays(fastest.minutes) <= 30, `fastest days ${travelDays(fastest.minutes)}`);
  assert.ok(fastest.minutes < foot.minutes / 3, 'the mode spread is real');
});
