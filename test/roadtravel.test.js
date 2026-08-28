// R4 — TRAVELLING BY ROAD. Pins for systems/roadTravel.js and the two
// optional deps added to systems/travel.js.
//
// The load-bearing pin is the first one: with the deps absent,
// calculateTravelTime must answer what the verbatim port answered, to
// the minute. Everything enhanced is allowed to exist only because
// that holds.

import { test } from 'node:test';
import assert from 'node:assert';

import {
  calculateTravelTime, walkTravelPath, travelPixelMinutes,
  CLIMATE_INDICES, TERRAIN_MOVEMENT_MODIFIERS,
} from '../src/systems/travel.js';
import {
  ROAD_SPEED, roadAtFor, cheapestPixelMinutes, chebyshev,
  walkRoadPath, planJourney,
} from '../src/systems/roadTravel.js';
import {
  createNetwork, linkPixels, ROAD_NONE, ROAD_TRACK, ROAD_TRUNK,
} from '../src/systems/roads.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const W = 40, H = 40;
const allWoodland = () => CLIMATES.Woodlands;

/** A straight trunk road across the middle of the map. */
function roadNetwork(y = 20, x0 = 2, x1 = 37) {
  const n = createNetwork(W, H);
  for (let x = x0; x < x1; x++) linkPixels(n.trunkExits, W, x, y, x + 1, y);
  return n;
}

// ── the classic law is untouched ─────────────────────────────────

test('with no deps, calculateTravelTime answers EXACTLY what the port answered', () => {
  // The per-pixel charge was lifted out of the loop body. Recomputed
  // here from the two C# tables directly, not by calling the extracted
  // function - or this would only prove the extraction agrees with
  // itself.
  const cases = [
    [{ x: 3, y: 3 }, { x: 30, y: 12 }, {}],
    [{ x: 30, y: 12 }, { x: 3, y: 3 }, { speedCautious: true }],
    [{ x: 0, y: 0 }, { x: 39, y: 39 }, { sleepModeInn: true, hasHorse: true }],
    [{ x: 5, y: 30 }, { x: 35, y: 2 }, { hasCart: true }],
    [{ x: 5, y: 30 }, { x: 35, y: 2 }, { travelShip: true }],
  ];
  const climateAt = (x, y) => (((x * 7 + y * 3) % 11) === 0
    ? CLIMATES.Ocean : CLIMATES.Ocean + ((x + y) % 10));
  for (const [start, end, opts] of cases) {
    const transportModifier = opts.hasHorse ? 128 : opts.hasCart ? 192 : 256;
    let minutes = 0, oceanPixels = 0;
    for (const { x, y } of walkTravelPath(start, end)) {
      const terrain = climateAt(x, y);
      let thisMove;
      if (terrain === CLIMATES.Ocean) {
        ++oceanPixels;
        thisMove = opts.travelShip ? 51 : 255;
      } else {
        const idx = CLIMATE_INDICES[terrain - CLIMATES.Ocean];
        thisMove = (((102 * transportModifier) >> 8)
          * (256 - TERRAIN_MOVEMENT_MODIFIERS[idx] + 256)) >> 8;
      }
      if (!opts.sleepModeInn) thisMove = (300 * thisMove) >> 8;
      minutes += thisMove;
    }
    if (!opts.speedCautious) minutes >>= 1;
    assert.deepEqual(calculateTravelTime(start, end, opts, climateAt),
      { minutes, oceanPixels }, `drifted on ${JSON.stringify(opts)}`);
  }
});

test('a roadAt that answers ROAD_NONE everywhere changes nothing', () => {
  const climateAt = () => CLIMATES.Woodlands;
  const a = calculateTravelTime({ x: 1, y: 1 }, { x: 30, y: 20 }, {}, climateAt);
  const b = calculateTravelTime({ x: 1, y: 1 }, { x: 30, y: 20 },
    { roadAt: () => ROAD_NONE, roadSpeed: ROAD_SPEED }, climateAt);
  assert.deepEqual(a, b);
});

test('roads never touch OCEAN pixels - there are no sea roads', () => {
  const climateAt = () => CLIMATES.Ocean;
  const plain = calculateTravelTime({ x: 1, y: 1 }, { x: 20, y: 1 }, {}, climateAt);
  const roaded = calculateTravelTime({ x: 1, y: 1 }, { x: 20, y: 1 },
    { roadAt: () => ROAD_TRUNK, roadSpeed: ROAD_SPEED }, climateAt);
  assert.deepEqual(plain, roaded);
  assert.ok(plain.oceanPixels > 0, 'the fixture must actually cross ocean');
});

test('the path dep charges the pixels it is given, not the ones it would have picked', () => {
  const climateAt = () => CLIMATES.Woodlands;
  const detour = [...walkTravelPath({ x: 1, y: 1 }, { x: 1, y: 10 }),
    ...walkTravelPath({ x: 1, y: 10 }, { x: 20, y: 10 })];
  const direct = calculateTravelTime({ x: 1, y: 1 }, { x: 20, y: 10 }, {}, climateAt);
  const walked = calculateTravelTime({ x: 1, y: 1 }, { x: 20, y: 10 },
    { path: detour }, climateAt);
  assert.ok(walked.minutes > direct.minutes,
    'a longer list of pixels must cost more minutes');
});

// ── the road term ────────────────────────────────────────────────

test('travelPixelMinutes with ROAD_NONE is the inline expression', () => {
  for (const c of [CLIMATES.Woodlands, CLIMATES.Swamp, CLIMATES.Mountain, CLIMATES.Desert]) {
    const idx = CLIMATE_INDICES[c - CLIMATES.Ocean];
    const expect = (300 * ((((102 * 256) >> 8)
      * (256 - TERRAIN_MOVEMENT_MODIFIERS[idx] + 256)) >> 8)) >> 8;
    assert.equal(travelPixelMinutes(c, 256, {}), expect, `climate ${c}`);
  }
});

test('a trunk beats a track beats bare ground, and none of them is a teleport', () => {
  const bare = travelPixelMinutes(CLIMATES.Woodlands, 256, { roadSpeed: ROAD_SPEED });
  const track = travelPixelMinutes(CLIMATES.Woodlands, 256,
    { roadKind: ROAD_TRACK, roadSpeed: ROAD_SPEED });
  const trunk = travelPixelMinutes(CLIMATES.Woodlands, 256,
    { roadKind: ROAD_TRUNK, roadSpeed: ROAD_SPEED });
  assert.ok(trunk < track, 'a trunk should beat a track');
  assert.ok(track < bare, 'and a track should beat bare ground');
  assert.ok(trunk > 0, 'but crossing ground still costs something');
  assert.equal(ROAD_SPEED[ROAD_NONE], 256, 'ROAD_NONE must be the identity multiplier');
});

test('the road term needs BOTH a class and a table - either alone is classic', () => {
  const withNoTable = travelPixelMinutes(CLIMATES.Woodlands, 256, { roadKind: ROAD_TRUNK });
  const classic = travelPixelMinutes(CLIMATES.Woodlands, 256, {});
  assert.equal(withNoTable, classic, 'a class with no table must not discount');
});

// ── the router ───────────────────────────────────────────────────

test('chebyshev IS classic\'s own path length', () => {
  // walkTravelPath's `furthest` is max(|dx|, |dy|) and it pushes one
  // pixel per iteration, so the two must agree for any pair - which is
  // what lets the heuristic be admissible and the routes comparable.
  for (const [a, b] of [
    [{ x: 0, y: 0 }, { x: 9, y: 3 }],
    [{ x: 4, y: 9 }, { x: 1, y: 1 }],
    [{ x: 7, y: 2 }, { x: 7, y: 20 }],
    [{ x: 5, y: 5 }, { x: 15, y: 15 }],
  ]) {
    assert.equal(walkTravelPath(a, b).length, chebyshev(a.x, a.y, b.x, b.y));
  }
});

test('the heuristic floor is computed from the law and never exceeds it', () => {
  const floor = cheapestPixelMinutes(256, { roadSpeed: ROAD_SPEED });
  for (let c = CLIMATES.Ocean; c <= CLIMATES.HauntedWoodlands; c++) {
    for (const kind of [ROAD_NONE, ROAD_TRACK, ROAD_TRUNK]) {
      assert.ok(travelPixelMinutes(c, 256, { roadKind: kind, roadSpeed: ROAD_SPEED }) >= floor,
        `climate ${c} kind ${kind} charges below the floor`);
    }
  }
});

test('the road route is NEVER worse than classic - classic is a member of the graph', () => {
  // The guarantee, and the honest answer to "does the enhanced skin
  // make travel slower". Any legal 8-connected walk is searchable, and
  // classic's own path is one, so a least-cost answer cannot lose.
  const net = roadNetwork();
  const climateAt = (x, y) => (y === 20 ? CLIMATES.Swamp : CLIMATES.Woodlands);
  const ctx = { width: W, height: H, climateAt, network: net, opts: {} };
  for (const [a, b] of [
    [{ x: 3, y: 5 }, { x: 34, y: 33 }],
    [{ x: 2, y: 21 }, { x: 36, y: 19 }],
    [{ x: 10, y: 2 }, { x: 12, y: 38 }],
  ]) {
    const road = walkRoadPath(a, b, ctx).path;
    const opts = { roadAt: roadAtFor(net), roadSpeed: ROAD_SPEED };
    const byRoad = calculateTravelTime(a, b, { ...opts, path: road }, climateAt);
    const classic = calculateTravelTime(a, b, opts, climateAt);
    assert.ok(byRoad.minutes <= classic.minutes,
      `road ${byRoad.minutes} > classic ${classic.minutes}`);
  }
});

test('a road worth taking IS taken - the route bends onto it', () => {
  // Without this the "never worse" pin passes trivially by always
  // returning the straight line.
  const net = roadNetwork();
  const climateAt = () => CLIMATES.Woodlands;
  const { path } = walkRoadPath({ x: 3, y: 16 }, { x: 36, y: 24 },
    { width: W, height: H, climateAt, network: net, opts: {} });
  const onRoad = path.filter((p) => p.y === 20 && p.x >= 2 && p.x <= 37).length;
  assert.ok(onRoad > 15, `expected the route to run along the road, got ${onRoad} pixels`);
});

test('no network means the straight line, and the router agrees with classic', () => {
  const climateAt = () => CLIMATES.Woodlands;
  const a = { x: 4, y: 4 }, b = { x: 30, y: 18 };
  const { path } = walkRoadPath(a, b, { width: W, height: H, climateAt, network: null, opts: {} });
  assert.equal(path.length, walkTravelPath(a, b).length,
    'over flat uniform ground with no roads, the cheapest walk is the same length as classic');
  assert.deepEqual(
    calculateTravelTime(a, b, { path }, climateAt),
    calculateTravelTime(a, b, {}, climateAt));
});

test('the path is in walkTravelPath\'s shape - start excluded, end included', () => {
  // It drops straight into calculateTravelTime's `path` dep and into
  // routePoints, which prepends the anchor itself. An included start
  // would be charged twice and drawn twice.
  const a = { x: 5, y: 5 }, b = { x: 12, y: 9 };
  const { path } = walkRoadPath(a, b, { width: W, height: H, climateAt: allWoodland, opts: {} });
  assert.deepEqual(path[path.length - 1], b, 'ends on the destination');
  assert.ok(!path.some((p) => p.x === a.x && p.y === a.y), 'and never contains the start');
  for (let i = 1; i < path.length; i++) {
    const dx = Math.abs(path[i].x - path[i - 1].x), dy = Math.abs(path[i].y - path[i - 1].y);
    assert.ok(dx <= 1 && dy <= 1 && dx + dy > 0, 'every step is one move');
  }
});

test('the router\'s OWN cost is the law\'s cost for the path it hands back', () => {
  // The property that makes the drawn route and the bill the same
  // thing. Summed independently over the ENTERED pixels, which is what
  // calculateTravelTime charges - charging the pixel LEFT instead
  // differs only at a road's two ends, and every other pin here
  // survived that mutation.
  const net = roadNetwork();
  const climateAt = (x, y) => (y === 20 ? CLIMATES.Swamp : CLIMATES.Woodlands);
  for (const [a, b] of [
    [{ x: 3, y: 15 }, { x: 36, y: 26 }],
    [{ x: 2, y: 20 }, { x: 37, y: 20 }],
    [{ x: 19, y: 2 }, { x: 21, y: 38 }],
  ]) {
    const { path, minutes } = walkRoadPath(a, b,
      { width: W, height: H, climateAt, network: net, opts: {} });
    let summed = 0;
    for (const p of path) {
      summed += travelPixelMinutes(climateAt(p.x, p.y), 256,
        { roadKind: roadAtFor(net)(p.x, p.y), roadSpeed: ROAD_SPEED });
    }
    assert.equal(minutes, summed,
      `router charged ${minutes}, the law charges ${summed} for the same pixels`);
    // and it is the same number the caller will be billed, pre-halving
    assert.equal(calculateTravelTime(a, b, {
      speedCautious: true, path, roadAt: roadAtFor(net), roadSpeed: ROAD_SPEED,
    }, climateAt).minutes, summed);
  }
});

test('travelling nowhere is an empty path, not a crash', () => {
  assert.deepEqual(walkRoadPath({ x: 5, y: 5 }, { x: 5, y: 5 },
    { width: W, height: H, climateAt: allWoodland, opts: {} }), { path: [], minutes: 0 });
});

// ── the journey ──────────────────────────────────────────────────

const calculate = (s, e, o) => calculateTravelTime(s, e, o, () => CLIMATES.Woodlands);

test('planJourney disabled is classic, path and minutes both', () => {
  const a = { x: 2, y: 2 }, b = { x: 30, y: 25 };
  const j = planJourney(a, b, {
    enabled: false, width: W, height: H, climateAt: allWoodland,
    network: roadNetwork(), calculate,
  });
  assert.equal(j.byRoad, false);
  assert.deepEqual(j.path, walkTravelPath(a, b));
  assert.equal(j.minutes, calculateTravelTime(a, b, {}, allWoodland).minutes);
});

test('planJourney with no network is classic even when enabled', () => {
  const a = { x: 2, y: 2 }, b = { x: 30, y: 25 };
  const j = planJourney(a, b, {
    enabled: true, width: W, height: H, climateAt: allWoodland, network: null, calculate,
  });
  assert.equal(j.byRoad, false);
  assert.deepEqual(j.path, walkTravelPath(a, b));
});

test('ONE path serves the line, the flight and the bill', () => {
  // The whole point of the slice: the minutes returned are the minutes
  // of the path returned. If planJourney priced one path and handed
  // back another, the map would draw a journey the player was not
  // charged for and nothing would throw.
  const net = roadNetwork();
  const a = { x: 3, y: 15 }, b = { x: 36, y: 26 };
  const j = planJourney(a, b, {
    enabled: true, width: W, height: H, climateAt: allWoodland, network: net, calculate,
  });
  assert.ok(j.byRoad, 'the fixture must actually route by road to test this');
  const repriced = calculateTravelTime(a, b, {
    path: j.path, roadAt: roadAtFor(net), roadSpeed: ROAD_SPEED,
  }, allWoodland);
  assert.equal(j.minutes, repriced.minutes, 'the bill must be for the path handed back');
  assert.ok(j.minutes <= calculateTravelTime(a, b, {}, allWoodland).minutes);
});

test('the ocean count still comes back, because the trip cost needs it', () => {
  const climateAt = (x) => (x > 15 && x < 25 ? CLIMATES.Ocean : CLIMATES.Woodlands);
  const j = planJourney({ x: 2, y: 20 }, { x: 38, y: 20 }, {
    enabled: true, width: W, height: H, climateAt, network: null,
    calculate: (s, e, o) => calculateTravelTime(s, e, o, climateAt),
  });
  assert.ok(j.oceanPixels > 0, 'calculateTripCost is priced off this');
});
