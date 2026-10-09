// TV-BEYOND (FIELD BUGS 2026-10-09 #8 and #9, maya on Discord: "if i bug the game outside of the bay i can become
// invisible to everyone and everyone becomes invisible to me", "i relogged and im still invisible"; and from the same
// wilds, a click on the Overworld: "CRASH (2) RangeError: invalid array length" up through `onPick`;
// `01-Overview/Field-Bugs-2026-10-09.md`) - THE LAND PAST THE BAY IS THE WORLD'S. TAMRIEL2 streams the ground beyond
// the Bay's edge, and two laws still ended at it:
//
// - THE PLANNER (systems/travelRoute.js) clamped its search box to the map. Two ends beyond one edge clamped it inside
//   out (a negative width: the typed arrays threw - the crash), one beyond it was indexed into the box's far side (a
//   route from a pixel the traveller never stood on), a road's byte was read a row over across the west edge, and the
//   ground past the map was the sea (routeGround) - so nothing there could be walked to.
// - THE WIRE (net/wire.js) held the Bay: a pose past 1024 pixels was refused and the relay closed the socket (every
//   peer gone, and a relog stood there again), a cell west or north of the Bay was no cell (a room no one's halo
//   reached), and a traveller's mark or a party pose there was never sent.
//
// Built on the real planner, the real routeGround, the host's own water law lifted out of world.js and run, and the
// real wire laws both ends run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planRoute, routeGround, BEYOND_CACHE_MAX } from '../src/systems/travelRoute.js';
import { DIR_DELTA } from '../src/world/roadNetwork.js';
import {
  WORLD_PIXEL_BOUND, worldPixelOk, POSE_BOUND, PIXEL_UNITS, validPose, parseClient, isCellRoom, worldRoom, cellHaloFor, inRange,
  validTravellerMark, validPartyPose, validDuelData, validParkData,
} from '../src/net/wire.js';
import { travellerMarkOf, travellerWorldOf, TRAV_FRACTION } from '../src/systems/travellerMarks.js';
import { tamrielFrameInBay, setTamrielFit, BAY_ORIGIN, PIXELS_PER_PICTURE_UNIT } from '../src/world/tamrielFrame.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const bit = (dx, dy) => DIR_DELTA.find(([, x, y]) => x === dx && y === dy)[0];

test('TV-BEYOND, the crash: a click on the Overworld with the traveller and the spot both past the Bay\'s edge plans a route - the box was clamped to the map, inside out, and its typed arrays threw "invalid array length"; one end past it plans from the pixel the traveller stands on', () => {
  for (const [from, to] of [
    [{ x: -10, y: 300 }, { x: -8, y: 300 }],      // west of the Alik'r: two pixels apart, the view's own reach
    [{ x: 5, y: 510 }, { x: 7, y: 512 }],          // south of the map
    [{ x: 300, y: -40 }, { x: 303, y: -42 }],      // north of it
    [{ x: 1010, y: 200 }, { x: 1005, y: 200 }],    // east of it
  ]) {
    const r = planRoute(from, to);
    assert.ok(r, `${JSON.stringify(from)} -> ${JSON.stringify(to)}: a route`);
    assert.deepEqual(r.pixels[0], from, 'from where the traveller stands');
    assert.deepEqual(r.pixels.at(-1), to, 'to the spot asked');
    assert.equal(r.kinds.length, r.pixels.length - 1);
  }
  // one end past the edge: the route began at a pixel on the box's far side (the local index wrapped)
  const half = planRoute({ x: -3, y: 300 }, { x: 4, y: 300 });
  assert.deepEqual(half.pixels.map((p) => p.x), [-3, -2, -1, 0, 1, 2, 3, 4]);
  assert.ok(half.pixels.every((p) => p.y === 300), 'the straight walk, every step on its own row');
});

test('TV-BEYOND, the ground past the table: routeGround asks the host\'s `beyond` for a pixel off its table (once a pixel, kept), the land there walked and its sea refused; without it off the table is the sea, DFU\'s empty edge', () => {
  const W = 20, H = 10;
  const calls = new Map();
  const beyond = (x, y) => { calls.set(`${x},${y}`, (calls.get(`${x},${y}`) ?? 0) + 1); return x >= -5; };   // a strip of land five pixels wide west of the table
  const g = routeGround(() => 231, () => 60, 2, W, H, beyond);
  assert.equal(g.isWater(-3, 4), false, 'the land past the table');
  assert.equal(g.isWater(-6, 4), true, 'its sea');
  assert.equal(g.isWater(3, 4), false, 'the table itself as ever');
  g.isWater(-3, 4); g.isWater(-3, 4);
  assert.equal(calls.get('-3,4'), 1, 'asked once a pixel');
  const walk = planRoute({ x: -1, y: 5 }, { x: -4, y: 5 }, { width: W, height: H, ...g });
  assert.deepEqual(walk.pixels.map((p) => p.x), [-1, -2, -3, -4], 'walked on the land past the table');
  assert.equal(planRoute({ x: -1, y: 5 }, { x: -7, y: 5 }, { width: W, height: H, ...g, maxExpansions: 5000 }), null, 'never across its sea');
  const sea = routeGround(() => 231, () => 60, 2, W, H);
  assert.equal(sea.isWater(-3, 4), true, 'no `beyond`: off the table is the sea');
  assert.equal(planRoute({ x: -1, y: 5 }, { x: -4, y: 5 }, { width: W, height: H, ...sea, maxExpansions: 5000 }), null, 'and nothing past it is walked');
  // the keep is bounded: past BEYOND_CACHE_MAX answers it is dropped whole, and a pixel is asked again
  for (let i = 0; i < BEYOND_CACHE_MAX; i++) g.isWater(-1 - (i % 4), -1 - Math.floor(i / 4));
  g.isWater(-3, 4);
  assert.equal(calls.get('-3,4'), 2, 'asked again after the keep was dropped');
});

test('TV-BEYOND, the land\'s pieces: an end past the table is in no piece - `apart` leaves it to the search, where it said "no way by land" for every pick past the Bay', () => {
  const W = 20, H = 10;
  const g = routeGround(() => 231, (x) => (x === 10 ? 0 : 60), 2, W, H, (x) => x >= -5);   // a channel down column 10
  assert.equal(g.apart({ x: 2, y: 5 }, { x: 15, y: 5 }), true, 'the table\'s own pieces still answer');
  assert.equal(g.apart({ x: 2, y: 5 }, { x: 4, y: 5 }), false);
  assert.equal(g.apart({ x: -2, y: 5 }, { x: 4, y: 5 }), false, 'from past the table: the search answers');
  assert.equal(g.apart({ x: 4, y: 5 }, { x: -2, y: 5 }), false, 'to past the table: the search answers');
});

test('TV-BEYOND, no road\'s byte past the table: a step west of the map read the row above\'s last bytes (a road a whole map away) - it is the open ground', () => {
  const W = 20, H = 10;
  const roads = new Uint8Array(W * H);
  // a road between (18, 4) and (19, 4) - the very bytes (-2, 5) and (-1, 5) wrapped onto
  roads[4 * W + 18] |= bit(1, 0); roads[4 * W + 19] |= bit(-1, 0);
  const r = planRoute({ x: -1, y: 5 }, { x: -2, y: 5 }, { width: W, height: H, roads });
  assert.deepEqual(r.kinds, ['open']);
  assert.equal(r.cost, 3.5, 'the open ground\'s price, not the road\'s');
  const onMap = planRoute({ x: 19, y: 4 }, { x: 18, y: 4 }, { width: W, height: H, roads });
  assert.deepEqual(onMap.kinds, ['road'], 'the road itself, where it lies');
});

test('TV-BEYOND, the host: the Overworld\'s water law is the ground\'s own past the Bay where TAMRIEL2 composed the reader, the sea off the map where it did not; the planner is handed it', () => {
  const w = rd('src/scenes/world.js');
  const line = w.match(/^ {2}const tvWater = \(px, py\) => [^\n]+$/m)?.[0];
  assert.ok(line, 'the host\'s own line');
  const tvWaterOf = (woods) => new Function('woods', 'WATER_BYTE', `${line}\nreturn tvWater;`)(woods, 2);
  const bay = tvWaterOf({ getHeightMapValue: (x, y) => (x < 0 || y < 0 ? 60 : y === 7 ? 0 : 60) });   // WoodsFile clamps: off the map reads the edge's byte
  assert.equal(bay(-1, 5), true, 'no land past the Bay: off the map is the sea, the clamp\'s byte never believed');
  assert.equal(bay(5, 5), false); assert.equal(bay(5, 7), true, 'on the map, the bytes');
  const composed = tvWaterOf({ isTamrielGround: true, getHeightMapValue: (x) => (x < -10 ? 0 : 60) });
  assert.equal(composed(-1, 5), false, 'the land past the Bay is land');
  assert.equal(composed(-20, 5), true, 'and its sea the sea');
  assert.match(w, /WATER_BYTE, 1000, 500, \(x, y\) => !tvWater\(x, y\)\)\)\.setRocks\(tvWodRocks\(\)\);/, 'routeGround is handed the land past the Bay as the view\'s own law reads it');
});

test('TV-BEYOND, the wire\'s world: every fit\'s frame lies inside WORLD_PIXEL_BOUND, and a pose anywhere on it is carried - the relay refused one past 1024 pixels and closed the socket on it ("bad pose")', () => {
  const poseAt = (px, py) => ({ x: px * PIXEL_UNITS + 100, y: 0, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
  try {
    for (const ppu of [16, PIXELS_PER_PICTURE_UNIT, 21]) {   // TAMRIEL3 reads the picture's fit, 16..21 pixels a picture unit
      const k = ppu / PIXELS_PER_PICTURE_UNIT;
      setTamrielFit({ ox: BAY_ORIGIN.x * k, oy: BAY_ORIGIN.y * k, ppu });
      const f = tamrielFrameInBay();
      for (const px of [Math.floor(f.x0), Math.ceil(f.x0 + f.w) - 1]) {
        for (const py of [Math.floor(f.y0), Math.ceil(f.y0 + f.h) - 1]) {
          assert.ok(worldPixelOk(px) && worldPixelOk(py), `fit ${ppu}: the frame's corner (${px}, ${py}) is the world's pixel`);
          assert.ok(validPose(poseAt(px, py)), `fit ${ppu}: a pose at (${px}, ${py})`);
          assert.deepEqual(parseClient(JSON.stringify({ t: 'pose', p: poseAt(px, py) }), { hasHello: true }).t, 'pose', 'the relay takes it - no "bad pose", no close');
        }
      }
    }
  } finally { setTamrielFit(null); }
  assert.equal(POSE_BOUND, WORLD_PIXEL_BOUND * PIXEL_UNITS, 'one bound, in the pose\'s units');
  assert.equal(validPose({ ...poseAt(0, 0), x: POSE_BOUND + 1 }), null, 'past the world: refused');
  assert.equal(worldPixelOk(WORLD_PIXEL_BOUND), false); assert.equal(worldPixelOk(-WORLD_PIXEL_BOUND), false);
  assert.equal(worldPixelOk(WORLD_PIXEL_BOUND - 1), true); assert.equal(worldPixelOk(1 - WORLD_PIXEL_BOUND), true); assert.equal(worldPixelOk(1.5), false);
});

test('TV-BEYOND, the cells past the Bay: a cell west or north of it is a cell, and the halo reaches across the edge both ways - two players a pixel apart astride it were in rooms that never met', () => {
  const west = worldRoom(-1, 300), east = worldRoom(0, 300);
  assert.equal(west, 'world:-1,18'); assert.equal(east, 'world:0,18');
  assert.equal(isCellRoom(west), true, 'the room past the edge is a cell');
  assert.equal(isCellRoom(worldRoom(-862, -975)), true, 'the continent\'s far corner too');
  assert.equal(isCellRoom('world:-1234,1'), false); assert.equal(isCellRoom('world:--1,1'), false);
  assert.ok(cellHaloFor(0, 300).includes(west), 'a player on the Bay\'s edge hears the cell past it');
  assert.ok(cellHaloFor(-1, 300).includes(east), 'and one past it hears the Bay\'s');
  assert.ok(cellHaloFor(300, 0).includes(worldRoom(300, -1)), 'the north edge the same');
  const a = { x: -0.5 * PIXEL_UNITS, z: 200 * PIXEL_UNITS }, b = { x: 0.5 * PIXEL_UNITS, z: 200 * PIXEL_UNITS };
  assert.equal(inRange(west, a, b), true, 'in range of each other');
});

test('TV-BEYOND, the marks and the party past the Bay: a traveller\'s mark is the world\'s (it was clamped onto the Bay, a traveller beyond it shown at the edge), a party pose\'s pixel, trip, walk and standing place carried, a duel\'s ring and a park\'s anchor taken either side of the corner', () => {
  for (const [x, z] of [[-5 * PIXEL_UNITS - 100, 600 * PIXEL_UNITS + 5], [3000 * PIXEL_UNITS + 7, -1500 * PIXEL_UNITS - 9], [207 * PIXEL_UNITS + 100, 286 * PIXEL_UNITS + 900]]) {
    const m = travellerMarkOf({ x, z, yaw: 1, mode: 'Horse', journey: true });
    assert.deepEqual(validTravellerMark(m), m, 'a valid mark, sent as it is');
    const back = travellerWorldOf(m);
    assert.ok(Math.abs(back.x - x) <= TRAV_FRACTION && Math.abs(back.z - z) <= TRAV_FRACTION, `${x}, ${z}: where the traveller stands, to a 256th`);
  }
  assert.deepEqual(travellerMarkOf({ x: -5 * PIXEL_UNITS - 100, z: 600 * PIXEL_UNITS + 5 }).px, -6, 'floored past the west edge');
  assert.equal(validTravellerMark({ px: WORLD_PIXEL_BOUND, py: 1, fx: 0, fy: 0, h: 0, m: 0 }), null, 'past the world refused whole');
  const P = { px: -10, py: -3, loc: 'Wilds', in: 0, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20 };
  const pose = validPartyPose({ ...P, tv: { x: -12, y: 520, o: 1, at: 5 }, tw: { x: -11, y: -2, sx: -11 * PIXEL_UNITS + 5, sz: 600 * PIXEL_UNITS, at: 5, go: 6 }, wx: -10 * PIXEL_UNITS, wy: 1, wz: 501 * PIXEL_UNITS });
  assert.equal(pose.px, -10); assert.equal(pose.py, -3);
  assert.deepEqual(pose.tv, { x: -12, y: 520, o: 1, at: 5, go: null }, 'the leader\'s trip past the Bay');
  assert.deepEqual(pose.tw, { x: -11, y: -2, at: 5, go: 6, h: null, sx: -11 * PIXEL_UNITS + 5, sz: 600 * PIXEL_UNITS }, 'the leader\'s walk past the Bay');
  assert.deepEqual([pose.wx, pose.wz], [-10 * PIXEL_UNITS, 501 * PIXEL_UNITS], 'where I stand, for the member travelling to me');
  assert.equal(validPartyPose({ ...P, px: -1e9 }).px, 1 - WORLD_PIXEL_BOUND, 'clamped into the world, as the map\'s was');
  const S = 'abc123def0';
  assert.deepEqual(validDuelData({ to: 'peer-0002', s: S, k: 'start', c: [-5 * PIXEL_UNITS, 1, -3] }).c, [-5 * PIXEL_UNITS, 1, -3], 'a ring past the west edge');
  assert.equal(validDuelData({ to: 'peer-0002', s: S, k: 'start', c: [-POSE_BOUND - 1, 1, 0] }), null);
  assert.deepEqual(validParkData({ c: 'char-ann-0001', a: [-PIXEL_UNITS, -2] }), { c: 'char-ann-0001', a: [-PIXEL_UNITS, -2] }, 'a horse parked past it');
});
