// R5 — THE ROAD ON THE GROUND. Pins for world/roadTiles.js.
//
// The pin that matters most is the orientation one. Getting north and
// south backwards breaks every road at every map-pixel boundary while
// each pixel looks perfectly correct in isolation, and no assertion
// about a single tilemap could ever see it. So the claim is held
// against generateTileData's ACTUAL output, not against a comment.

import { test } from 'node:test';
import assert from 'node:assert';

import {
  ROAD_TILE_RECORDS, ROAD_TILE_RECORD, ROAD_TILE_HALF_WIDTH,
  exitTile, paintRoadTiles,
} from '../src/world/roadTiles.js';
import {
  WORLD_MAP_TILE_DIM, generateTileData, assignTiles,
} from '../src/world/terrainTiles.js';
import {
  createNetwork, linkPixels, DIRS, ROAD_TRACK, ROAD_TRUNK,
} from '../src/systems/roads.js';
import { tileWeight } from '../src/world/cityNavigation.js';

const T = WORLD_MAP_TILE_DIM;
const MID = T >> 1;
const blank = () => new Uint8Array(T * T);

/** Direction index by name, so the pins read as compass. */
const DIR = Object.fromEntries(DIRS.map((d, i) => [d.name, i]));

// ── orientation, held against the port's own code ────────────────

test('tile row 127 is NORTH - checked against generateTileData, not against a comment', () => {
  // generateTileData feeds noise with
  //     longitude = MAX_WORLD_TILE_COORD_Z - mapPixelY * 128 + y
  // so the two rows that are genuinely adjacent across a north-south
  // pixel boundary are row 127 of the southern pixel and row 0 of the
  // northern one. The noise field is continuous, so those rows must
  // agree far better than the reversed pairing does.
  //
  // A flat high heightmap keeps every sample out of the ocean and
  // beach branches, which would answer WATER/DIRT regardless of
  // longitude and hide the effect entirely.
  const hDim = 129;
  const high = new Float32Array(hDim * hDim).fill(0.9);
  const px = 300, py = 200;
  const south = generateTileData(high, px, py, hDim);       // (px, py)
  const north = generateTileData(high, px, py - 1, hDim);   // one pixel NORTH
  const tdDim = T + 1;

  const agree = (rowA, aData, rowB, bData) => {
    let same = 0;
    for (let x = 0; x < T; x++) {
      if (aData[x + rowA * tdDim] === bData[x + rowB * tdDim]) same++;
    }
    return same / T;
  };

  const claimed = agree(T - 1, south, 0, north);   // row 127 south <-> row 0 north
  const reversed = agree(0, south, T - 1, north);  // the naive pairing
  assert.ok(claimed > reversed,
    `row 127<->row 0 agreed ${(claimed * 100).toFixed(0)}%, the reverse ${(reversed * 100).toFixed(0)}%`);
  assert.ok(claimed > 0.85,
    `a continuous noise field should nearly match across the true seam, got ${claimed.toFixed(2)}`);
});

test('exitTile sends each compass exit to the right edge', () => {
  assert.deepEqual(exitTile(DIR.N), { x: MID, y: T - 1 }, 'north is the HIGH row');
  assert.deepEqual(exitTile(DIR.S), { x: MID, y: 0 }, 'south is row zero');
  assert.deepEqual(exitTile(DIR.E), { x: T - 1, y: MID }, 'east is the high column');
  assert.deepEqual(exitTile(DIR.W), { x: 0, y: MID });
  assert.deepEqual(exitTile(DIR.NE), { x: T - 1, y: T - 1 });
  assert.deepEqual(exitTile(DIR.SW), { x: 0, y: 0 });
  assert.deepEqual(exitTile(DIR.NW), { x: 0, y: T - 1 });
  assert.deepEqual(exitTile(DIR.SE), { x: T - 1, y: 0 });
});

test('opposite exits land on opposite edges - the condition for meeting', () => {
  // Mirrored only along the axis the direction actually moves in. N
  // and S both sit at the middle column, so those must be EQUAL - and
  // 64 + 64 is 128, not 127, which is how the first version of this
  // assertion failed against perfectly correct code.
  for (let d = 0; d < 8; d++) {
    const { dx, dy } = DIRS[d];
    const a = exitTile(d), b = exitTile((d + 4) & 7);
    if (dx === 0) assert.equal(a.x, b.x, `${DIRS[d].name}: should share the middle column`);
    else assert.equal(a.x + b.x, T - 1, `${DIRS[d].name}: columns must mirror`);
    if (dy === 0) assert.equal(a.y, b.y, `${DIRS[d].name}: should share the middle row`);
    else assert.equal(a.y + b.y, T - 1, `${DIRS[d].name}: rows must mirror`);
  }
});

// ── continuity across the boundary ───────────────────────────────

test('a road crossing a pixel boundary MEETS on both sides', () => {
  // The whole reason the orientation had to be derived. Two pixels
  // linked north-south: the southern one's road must reach its row
  // 127 and the northern one's must reach its row 0, at the same
  // column, or the road has a gap at every boundary.
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 4, 5, 4, 4);   // (4,5) -- N --> (4,4)

  const south = blank(), north = blank();
  paintRoadTiles(south, net, 4, 5);
  paintRoadTiles(north, net, 4, 4);

  const row = (map, y) => Array.from({ length: T }, (_, x) => map[x + y * T]);
  const southEdge = row(south, T - 1);
  const northEdge = row(north, 0);
  assert.ok(southEdge.some((v) => v !== 0), 'the southern pixel never reached its north edge');
  assert.ok(northEdge.some((v) => v !== 0), 'the northern pixel never reached its south edge');
  for (let x = 0; x < T; x++) {
    assert.equal(southEdge[x] !== 0, northEdge[x] !== 0,
      `the road does not line up at column ${x}`);
  }
});

test('east-west meets too, and the far edges stay clear', () => {
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 3, 3, 4, 3);   // (3,3) -- E --> (4,3)
  const west = blank(), east = blank();
  paintRoadTiles(west, net, 3, 3);
  paintRoadTiles(east, net, 4, 3);
  const col = (map, x) => Array.from({ length: T }, (_, y) => map[x + y * T]);
  for (let y = 0; y < T; y++) {
    assert.equal(col(west, T - 1)[y] !== 0, col(east, 0)[y] !== 0,
      `mismatch at row ${y}`);
  }
  // and neither painted an edge it has no exit through
  assert.ok(col(west, 0).every((v) => v === 0), 'the west pixel painted its west edge');
  assert.ok(col(east, T - 1).every((v) => v === 0), 'the east pixel painted its east edge');
});

// ── the paint itself ─────────────────────────────────────────────

test('a pixel with no road is left completely alone', () => {
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 1, 1, 2, 1);
  const map = blank();
  assert.equal(paintRoadTiles(map, net, 6, 6), 0);
  assert.ok(map.every((v) => v === 0));
  assert.equal(paintRoadTiles(map, null, 1, 1), 0, 'and no network is not a crash');
});

test('everything painted is a record the nav law calls road', () => {
  // A road drawn with a record GetTileWeight does not recognise is a
  // road nothing else treats as one.
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 4, 4, 5, 4);
  linkPixels(net.trackExits, 8, 4, 4, 4, 5);
  const map = blank();
  paintRoadTiles(map, net, 4, 4);
  const used = new Set(map.filter((v) => v !== 0));
  assert.ok(used.size > 0, 'nothing was painted');
  for (const rec of used) {
    assert.ok(ROAD_TILE_RECORDS.includes(rec), `record ${rec} is not a road record`);
    assert.equal(tileWeight(rec), 15, `record ${rec} is not weighted as road`);
  }
  assert.ok(ROAD_TILE_RECORDS.includes(ROAD_TILE_RECORD), 'the default must be one of them');
});

test('the paint honours assignTiles\' own skip rule - a town keeps its ground', () => {
  // Painting after setLocationTiles and skipping non-zero is what
  // keeps the 1:1 tile law untouched: the road runs up to the town and
  // the town takes over.
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 4, 4, 5, 4);
  const map = blank();
  const TOWN = 200;
  for (let y = MID - 8; y <= MID + 8; y++) {
    for (let x = MID - 8; x <= MID + 8; x++) map[x + y * T] = TOWN;
  }
  paintRoadTiles(map, net, 4, 4);
  for (let y = MID - 8; y <= MID + 8; y++) {
    for (let x = MID - 8; x <= MID + 8; x++) {
      assert.equal(map[x + y * T], TOWN, `the road overwrote the town at ${x},${y}`);
    }
  }
  assert.ok(map[(T - 4) + MID * T] !== 0, 'but it still painted outside the rect');
});

test('assignTiles then leaves the road alone', () => {
  // The seam: marching squares skips non-zero, so once the road is
  // down it survives the tile pass untouched.
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 4, 4, 5, 4);
  const map = blank();
  paintRoadTiles(map, net, 4, 4);
  const before = Array.from(map);
  const hDim = 129;
  assignTiles(generateTileData(new Float32Array(hDim * hDim).fill(0.9), 4, 4, hDim), map, true);
  for (let i = 0; i < map.length; i++) {
    if (before[i] !== 0) assert.equal(map[i], before[i], `assignTiles overwrote road at ${i}`);
  }
  assert.ok(map.every((v) => v !== 0), 'and it filled everything else');
});

test('a trunk is wider than a track', () => {
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 2, 2, 3, 2);
  linkPixels(net.trackExits, 8, 5, 5, 6, 5);
  const trunkMap = blank(), trackMap = blank();
  paintRoadTiles(trunkMap, net, 2, 2);
  paintRoadTiles(trackMap, net, 5, 5);
  const count = (m) => m.reduce((a, v) => a + (v !== 0 ? 1 : 0), 0);
  assert.ok(count(trunkMap) > count(trackMap), 'the trunk band should be the wider one');
  assert.ok(ROAD_TILE_HALF_WIDTH[ROAD_TRUNK] > ROAD_TILE_HALF_WIDTH[ROAD_TRACK]);
});

test('a dead end stops in the middle instead of crossing', () => {
  // What a road into a village that goes no further looks like.
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 4, 4, 5, 4);   // (5,4) only has a W exit
  const map = blank();
  paintRoadTiles(map, net, 5, 4);
  const col = (x) => Array.from({ length: T }, (_, y) => map[x + y * T]);
  assert.ok(col(0).some((v) => v !== 0), 'it should reach the west edge it came from');
  assert.ok(col(T - 1).every((v) => v === 0), 'and must not carry on out the east side');
  assert.ok(map[MID + MID * T] !== 0, 'but it does reach the centre');
});

test('nothing is painted outside the tilemap, whatever the exits', () => {
  const net = createNetwork(8, 8);
  for (let d = 0; d < 8; d++) {
    const n = DIRS[d];
    linkPixels(net.trunkExits, 8, 4, 4, 4 + n.dx, 4 + n.dy);
  }
  const map = new Uint8Array(T * T + 64).fill(0);
  const view = map.subarray(0, T * T);
  paintRoadTiles(view, net, 4, 4);
  for (let i = T * T; i < map.length; i++) {
    assert.equal(map[i], 0, `wrote past the end of the tilemap at ${i}`);
  }
  // all eight exits reached their edges
  for (let d = 0; d < 8; d++) {
    const e = exitTile(d);
    assert.ok(view[e.x + e.y * T] !== 0, `${DIRS[d].name} never reached its edge`);
  }
});

test('painting is deterministic', () => {
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 4, 4, 5, 5);
  const a = blank(), b = blank();
  paintRoadTiles(a, net, 4, 4);
  paintRoadTiles(b, net, 4, 4);
  assert.deepEqual([...a], [...b]);
});
