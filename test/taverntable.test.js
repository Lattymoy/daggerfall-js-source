// TAVERN-TABLE (2026-10-08, the owner: "Lets instead place a specific table in each inn. A new property specifficaly
// used for the card table"; bible/11-Multiplayer/Tavern-Cards.md section 28): every tavern stands the card table's own
// prop (world/cardTableProp.js, pure: its model and its painted felt and wood), on floor found from the entrance
// (world/placedCardTable.js, pure), as one of the room's own models and its one card table (scenes/interiorContext.js),
// asked for by the interior host for a tavern (scenes/worldModes.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  placedTableSpot, PLACE_CELL, PLACE_GRID_OFF, PLACE_REACH_M, PLACE_FROM_DOOR_M, PLACE_RING_M, PLACE_BODY_R,
  PLACE_CLEAR_HEIGHTS, PLACE_STOREY_SLACK, PLACE_PROBE_M, PLACE_AVOID_DY,
} from '../src/world/placedCardTable.js';
import { SEAT_SPACING, cardTableSeats, seatFloorOk, SEAT_FLOOR_PROBE, tableFrame, seatSpots, SEAT_SURFACE_MAX } from '../src/world/cardTables.js';
import {
  cardTablePropModel, paintFelt, paintWood, texelNoise, CARD_TABLE_ARCHIVE, FELT_RECORD, WOOD_RECORD, CARD_TABLE_W, CARD_TABLE_D,
  CARD_TABLE_TOP, CARD_TABLE_SLAB, CARD_TABLE_RAIL, CARD_TABLE_FELT_LIFT, CARD_TABLE_LEG, CARD_TABLE_LEG_IN, WOOD_TILE_M,
  CARD_TABLE_TEX, FELT_RGB, WOOD_RGB, CARD_TABLE_BOX, STOOL_W, STOOL_TOP, STOOL_SEAT, STOOL_LEG, STOOL_LEG_IN,
} from '../src/world/cardTableProp.js';
import { cardModel } from '../src/render/cardTableDraw.js';
import { localAabb } from '../src/render/frustum.js';
import { HOLDEM_SEATS_MAX } from '../src/net/cardLaw.js';
import { SEAT_OUT, SEATED_EYE_HEIGHT, SEAT_TOP_DEFAULT, seatTopByte, seatTopOf } from '../src/player/seatPose.js';
import { STACK_IN } from '../src/world/cardScene.js';
import { CHIP_R } from '../src/world/cardMotion.js';
import { buildInteriorContext } from '../src/scenes/interiorContext.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// A room for the walk: `floorAt(x, z)` its floor's height (null for none), `boxes` its solids ({min, max}); a box's top
// under a point is a floor to the probe, and a box within r of a point is in the way.
function room({ floorAt = () => 0, boxes = [] } = {}) {
  const near = (b, x, y, z) => Math.hypot(Math.max(b.min[0] - x, 0, x - b.max[0]), Math.max(b.min[1] - y, 0, y - b.max[1]), Math.max(b.min[2] - z, 0, z - b.max[2]));
  const calls = { floor: 0, open: 0 };
  return {
    calls,
    floor(x, y, z) {
      calls.floor++;
      let best = floorAt(x, z);
      if (best != null && (best > y || best < y - 3)) best = null;
      for (const b of boxes) if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2] && b.max[1] <= y && (best == null || b.max[1] > best)) best = b.max[1];
      return best;
    },
    open(x, y, z, r) { calls.open++; return boxes.every((b) => near(b, x, y, z) >= r); },
  };
}
const BOX = { min: [-0.6, -0.4, -0.4], max: [0.6, 0.4, 0.4] };   // a table 1.2 by 0.8, its origin at its middle
const hall = (x0, x1, z0, z1) => (x, z) => (x >= x0 && x <= x1 && z >= z0 && z <= z1 ? 0 : null);

test('TAVERN-TABLE the walk\'s numbers: its cell and reach, the threshold, the ring a seated body needs, the body\'s clear, the storey\'s slack - the grid and every threshold off Daggerfall\'s 1/40 m lattice', () => {
  assert.deepEqual({ PLACE_CELL, PLACE_GRID_OFF: [...PLACE_GRID_OFF], PLACE_REACH_M, PLACE_FROM_DOOR_M, PLACE_BODY_R, PLACE_CLEAR_HEIGHTS: [...PLACE_CLEAR_HEIGHTS], PLACE_STOREY_SLACK, PLACE_PROBE_M, PLACE_AVOID_DY },
    { PLACE_CELL: 0.5, PLACE_GRID_OFF: [1 / 320, 1 / 640], PLACE_REACH_M: 16, PLACE_FROM_DOOR_M: 3, PLACE_BODY_R: 0.2875, PLACE_CLEAR_HEIGHTS: [0.6, 1.5], PLACE_STOREY_SLACK: 0.2125, PLACE_PROBE_M: 1.9125, PLACE_AVOID_DY: 2.5 });
  assert.equal(PLACE_RING_M, SEAT_OUT + 0.4);
  assert.ok(PLACE_RING_M * 2 + 1.2 >= 2 * SEAT_SPACING, 'a 1.2 m side seats one at least, with its ring clear');
  assert.ok(PLACE_RING_M > SEAT_OUT + STOOL_W / 2, 'the ring holds the prop\'s stools');
  // AUDIT TAVERN-TABLE M3: half a unit off the lattice, every threshold; an eighth and a sixteenth of one, the grid
  const units = (v) => v * 40;
  for (const v of [PLACE_BODY_R, PLACE_STOREY_SLACK, PLACE_PROBE_M]) assert.equal(units(v) % 1, 0.5, `${v} m is half a unit off`);
  assert.deepEqual(PLACE_GRID_OFF.map(units), [1 / 8, 1 / 16]);
});

// ── THE PROP ────────────────────────────────────────────────────────────────────────────────────────────────────────
const r6 = (v) => Math.round(v * 1e6) / 1e6;

test('TAVERN-TABLE the prop\'s numbers: a poker table 1.5 by 1 m, its top at the seated pose\'s own 0.8 m, a 4 cm rail round the felt, four legs, a stool at every seat; its two textures in its own archive', () => {
  assert.deepEqual({ CARD_TABLE_W, CARD_TABLE_D, CARD_TABLE_TOP, CARD_TABLE_SLAB, CARD_TABLE_RAIL, CARD_TABLE_FELT_LIFT, CARD_TABLE_LEG, CARD_TABLE_LEG_IN, WOOD_TILE_M, CARD_TABLE_TEX },
    { CARD_TABLE_W: 1.5, CARD_TABLE_D: 1, CARD_TABLE_TOP: 0.8, CARD_TABLE_SLAB: 0.06, CARD_TABLE_RAIL: 0.04, CARD_TABLE_FELT_LIFT: 0.002, CARD_TABLE_LEG: 0.07, CARD_TABLE_LEG_IN: 0.1, WOOD_TILE_M: 0.5, CARD_TABLE_TEX: 64 });
  assert.deepEqual({ STOOL_W, STOOL_TOP, STOOL_SEAT, STOOL_LEG, STOOL_LEG_IN }, { STOOL_W: 0.34, STOOL_TOP: 0.48, STOOL_SEAT: 0.04, STOOL_LEG: 0.04, STOOL_LEG_IN: 0.03 });
  assert.deepEqual([CARD_TABLE_ARCHIVE, FELT_RECORD, WOOD_RECORD, [...FELT_RGB], [...WOOD_RGB]], ['cardtable', 'felt', 'wood', [31, 90, 55], [107, 66, 38]]);
  assert.deepEqual({ min: [...CARD_TABLE_BOX.min], max: CARD_TABLE_BOX.max.map(r6) }, { min: [-0.75, 0, -0.5], max: [0.75, 0.802, 0.5] }, 'the table\'s own box, its top the felt\'s');
  // AUDIT TAVERN-TABLE L1: the top the seated pose\'s own table, on the wire\'s step - a peer draws the hands where they lie
  assert.equal(CARD_TABLE_TOP, SEAT_TOP_DEFAULT);
  assert.equal(seatTopOf(seatTopByte(CARD_TABLE_BOX.max[1])), CARD_TABLE_TOP);
  // AUDIT TAVERN-TABLE L2: a chip stack stands wholly on the felt - the rail narrower than its inset less its radius
  assert.ok(CARD_TABLE_RAIL <= STACK_IN - CHIP_R, `the rail ${CARD_TABLE_RAIL} under the stack\'s near edge ${STACK_IN - CHIP_R}`);
  // AUDIT TAVERN-TABLE M1: a stool is something to sit over, to the seat\'s own probe
  assert.equal(seatFloorOk(SEATED_EYE_HEIGHT - STOOL_TOP), true);
  assert.ok(STOOL_TOP <= SEAT_SURFACE_MAX);
});

test('TAVERN-TABLE the prop\'s model: its lowest point on the floor and the table\'s middle on the origin, the felt the top, a stool under every seat; the wood\'s triangles then the felt\'s', () => {
  const m = cardTablePropModel();
  assert.deepEqual(Array.from(localAabb(m.positions), r6), [-1.27, 0, -1.02, 1.27, 0.802, 1.02], 'the end stools 1.1 m out, the side ones 0.85 - SEAT_OUT past the edge, 0.17 each way');
  assert.deepEqual(m.subMeshes, [
    { textureArchive: 'cardtable', textureRecord: 'wood', startIndex: 0, primitiveCount: 52 + 6 * 52 },
    { textureArchive: 'cardtable', textureRecord: 'felt', startIndex: 3 * 364, primitiveCount: 2 },
  ], 'the table and each stool: a top\'s six faces and four legs\' five (no top under a top); the felt\'s one');
  assert.equal(m.indices.length, 3 * (364 + 2));
  assert.equal(m.positions.length / 3, m.normals.length / 3);
  assert.equal(m.positions.length / 3, m.uvs.length / 2);
  const P = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]].map(r6);
  // the felt: inside the 4 cm rail, 2 mm over the wood
  const felt = Array.from(m.indices.slice(3 * 364)).map(P);
  assert.deepEqual([...new Set(felt.map((p) => p.join(',')))].sort(), ['-0.71,0.802,-0.46', '-0.71,0.802,0.46', '0.71,0.802,-0.46', '0.71,0.802,0.46']);
  // the table's legs: 7 cm square, 10 cm in from each corner, from the floor to the slab's underside
  const floorAt = new Set();
  for (let i = 0; i < m.positions.length / 3; i++) { const p = P(i); if (p[1] === 0 && Math.abs(p[0]) <= 0.75 && Math.abs(p[2]) <= 0.5) floorAt.add(`${p[0]},${p[2]}`); }
  assert.deepEqual([...floorAt].sort(), ['-0.58,-0.33', '-0.58,-0.4', '-0.65,-0.33', '-0.65,-0.4', '-0.58,0.33', '-0.58,0.4', '-0.65,0.33', '-0.65,0.4',
    '0.58,-0.33', '0.58,-0.4', '0.65,-0.33', '0.65,-0.4', '0.58,0.33', '0.58,0.4', '0.65,0.33', '0.65,0.4'].sort());
  // a stool under each seat seatSpots stands: its top 0.48 m up, 0.34 m square, centred on the seat
  const tops = new Map();
  for (let i = 0; i < m.positions.length / 3; i++) { const p = P(i); if (p[1] === 0.48 && m.normals[i * 3 + 1] === 1) { const k = `${r6(Math.round(p[0] * 10) / 10)}`; (tops.get(k) ?? tops.set(k, []).get(k)).push(p); } }
  const centres = [];
  for (let i = 0; i < m.positions.length / 3; i += 4) {
    const p = P(i);
    if (p[1] === 0.48 && m.normals[i * 3 + 1] === 1) { const q = P(i + 2); centres.push([r6((p[0] + q[0]) / 2), r6((p[2] + q[2]) / 2), r6(q[0] - p[0]), r6(q[2] - p[2])]); }
  }
  assert.deepEqual(centres, seatSpots(CARD_TABLE_BOX).map((s) => [r6(s.lx), r6(s.lz), 0.34, 0.34]));
});

test('TAVERN-TABLE the prop\'s every triangle faces its normal, wound as a card\'s plate is (the renderer\'s front)', () => {
  const facing = (m) => {
    const out = [];
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => m.indices[t + k]);
      const p = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
      const [pa, pb, pc] = [p(a), p(b), p(c)];
      const u = pb.map((v, k) => v - pa[k]), w = pc.map((v, k) => v - pa[k]);
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      out.push(Math.sign(n[0] * m.normals[a * 3] + n[1] * m.normals[a * 3 + 1] + n[2] * m.normals[a * 3 + 2]));
    }
    return [...new Set(out)];
  };
  const card = facing(cardModel([0, 0]));
  assert.equal(card.length, 1, 'a card\'s plate winds one way');
  assert.deepEqual(facing(cardTablePropModel()), card, 'and the table winds the same way');
  // AUDIT TAVERN-TABLE L4: the uvs are each face's own metres over WOOD_TILE_M - the grain (u) along a top's length,
  // round a side, up a leg; the felt across its texture once
  const m = cardTablePropModel();
  const uv = (v) => Array.from(m.uvs.slice(v * 2, v * 2 + 8), r6);
  assert.deepEqual(uv(0), [-1.5, -1, 1.5, -1, 1.5, 1, -1.5, 1], 'the slab\'s top: u along x, v along z');
  assert.deepEqual(uv(16), [-1.5, 1.48, -1.5, 1.6, 1.5, 1.6, 1.5, 1.48], 'its +z side: u along x (the length), v up');
  assert.deepEqual(uv(8), [1, -1.48 * 0 - 1, 1, 1, 1, 1, 1, -1].map((_, k) => [1.5, 1.5, 1.5, 1.5][0] * 0 + [-1, 1, 1, -1, 1.48, 1.48, 1.6, 1.6][[0, 4, 1, 5, 2, 6, 3, 7][k]] * 0 + [-1, 1.48, 1, 1.48, 1, 1.6, -1, 1.6][k]), 'its +x side: u along z, v up');
  assert.deepEqual(uv(28), [0, -0.8, 0, -0.66, 1.48, -0.66, 1.48, -0.8], 'a leg\'s +x side: u UP the leg (the grain), v along z');
  assert.deepEqual(Array.from(m.uvs.slice(-8), r6), [0, 0, 1, 0, 1, 1, 0, 1]);
});

test('TAVERN-TABLE the prop seats six round its own box - two a long side, one an end - and its frame lies along its length', () => {
  const box = CARD_TABLE_BOX;
  const seats = cardTableSeats({ aabb: box, box }, () => true);
  assert.equal(seats.length, HOLDEM_SEATS_MAX);
  assert.deepEqual(seats.map((s) => s.side), ['+x', '-x', '+z', '+z', '-z', '-z']);
  const f = tableFrame({ aabb: box, box });
  assert.deepEqual([f.halfLong, f.halfShort].map(r6), [0.75, 0.5]);
  assert.equal(r6(f.centre[1]), 0.802, 'the cards lie on the felt');
});

test('TAVERN-TABLE the felt and the wood, painted here - 64 texels square, opaque, the same on every client, each its own colour about its base', () => {
  assert.deepEqual([texelNoise(0, 0, 1), texelNoise(3, 7, 1), texelNoise(3, 7, 2), texelNoise(7, 3, 1)].map(r6), [0.009705, 0.007432, 0.313795, 0.804717]);
  for (const [paint, rgb, lo, hi] of [[paintFelt, FELT_RGB, 0.9, 1.1], [paintWood, WOOD_RGB, 0.8, 1.11]]) {
    const t = paint();
    assert.deepEqual([t.width, t.height, t.colors.length, t.colors.constructor.name], [64, 64, 64 * 64 * 4, 'Uint8ClampedArray']);
    assert.deepEqual(t.colors, paint().colors, 'the same picture each time');
    const seen = new Set();
    for (let o = 0; o < t.colors.length; o += 4) {
      assert.equal(t.colors[o + 3], 255);
      for (let k = 0; k < 3; k++) assert.ok(t.colors[o + k] >= Math.floor(rgb[k] * lo) && t.colors[o + k] <= Math.ceil(rgb[k] * hi), `texel ${o / 4} channel ${k}`);
      seen.add(t.colors[o]);
    }
    assert.ok(seen.size > 4, 'not one flat colour');
  }
  // the felt's nap is per texel; the wood's grain runs along its rows
  const felt = paintFelt().colors, wood = paintWood().colors;
  assert.deepEqual(Array.from(felt.slice(0, 12)), [28, 81, 50, 255, 29, 86, 52, 255, 31, 90, 55, 255]);
  assert.deepEqual(Array.from(wood.slice(0, 12)), [98, 60, 35, 255, 98, 61, 35, 255, 95, 58, 34, 255]);
  assert.deepEqual(Array.from(wood.slice(256, 268)), [105, 65, 37, 255, 106, 66, 38, 255, 101, 62, 36, 255], 'the next row its own shade');
  const row = (y) => Array.from({ length: 64 }, (_, x) => wood[(y * 64 + x) * 4]);
  const spread = (a) => Math.max(...a) - Math.min(...a);
  assert.ok(spread(row(5)) <= Math.ceil(107 * 0.06) + 1, 'along a row the grain holds');
  assert.ok(spread(Array.from({ length: 64 }, (_, y) => wood[(y * 64) * 4])) > 10, 'across the rows it changes');
});

// the walk's answers less its grid's offset (PLACE_GRID_OFF), so a room's own round numbers read as they are
const rel = (sp) => sp && { x: r6(sp.x - PLACE_GRID_OFF[0]), y: r6(sp.y), z: r6(sp.z - PLACE_GRID_OFF[1]), yawDeg: sp.yawDeg, cx: r6(sp.cx - PLACE_GRID_OFF[0]), cz: r6(sp.cz - PLACE_GRID_OFF[1]) };
const walk = (box, start, r, avoid) => rel(placedTableSpot(box, start, r, avoid));
const AT3 = { x: 3, y: 0.4, z: 0, yawDeg: 0, cx: 3, cz: 0 };   // an open floor's answer for BOX from the origin
const BACK = { x: -3, y: 0.4, z: 0, yawDeg: 0, cx: -3, cz: 0 };   // ...and the other way

test('TAVERN-TABLE an open floor: the first cell the walk reaches PLACE_FROM_DOOR_M in (+x first), along x, the table\'s lowest point on the floor and its middle on the cell', () => {
  assert.deepEqual(walk(BOX, [0, 0.5, 0], room()), AT3);
  // a box off its origin: the translation stands its middle on the cell and its bottom on the floor
  assert.deepEqual(walk({ min: [0, 0, 0], max: [1.2, 0.8, 0.8] }, [1, 0, 2], room({ floorAt: () => 0.25 })), { x: 3.4, y: 0.25, z: 1.6, yawDeg: 0, cx: 4, cz: 2 });
});

test('TAVERN-TABLE nearest by the WALK, not the crow: a wall beside the entrance turns it the other way; through a doorway, the room beyond; the ring exactly as wide as it says', () => {
  const wall = { min: [1.4, 0, -20], max: [1.6, 3, 20] };
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ boxes: [wall] })), BACK);
  // a doorway: the room beyond is walked to - along x its ring would meet the doorway's jambs, turned it clears them
  const gap = [{ min: [1.4, 0, -20], max: [1.6, 3, -0.6] }, { min: [1.4, 0, 0.6], max: [1.6, 3, 20] }];
  const g = walk(BOX, [0, 0, 0], room({ boxes: gap }));
  assert.deepEqual(g, { ...AT3, yawDeg: 90 });
  assert.ok(g.cx - 0.4 - PLACE_RING_M >= 1.6, 'the table and its ring stand past the wall');
  // AUDIT TAVERN-TABLE M4: the ring asks the floor it says and no more - its edge 1.35 m out, a cell\'s own clear the
  // rest: a hall to 4.25 m holds the table at 2.5 (its ring to 3.85, the last cell 4.0 clear to 4.29), to 4.0 m none
  assert.equal(walk(BOX, [0, 0, 0], room({ floorAt: hall(-0.5, 4.0, -1.5, 1.5) })), null);
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ floorAt: hall(-0.5, 4.25, -1.5, 1.5) })), { x: 2.5, y: 0.4, z: -0.5, yawDeg: 0, cx: 2.5, cz: -0.5 });
});

test('TAVERN-TABLE turned a quarter where only across does it fit (AUDIT TAVERN-TABLE M4) - along x first where both do', () => {
  // a hall long in z and narrow in x: along x the ring wants 1.35 m each side of the middle, across 1.15
  const narrow = hall(-1.25, 1.25, -12, 12);
  const sp = walk(BOX, [0, 0, 0], room({ floorAt: narrow }));
  assert.deepEqual(sp, { x: 0, y: 0.4, z: 3, yawDeg: 90, cx: 0, cz: 3 });
  assert.equal(walk({ min: [-0.4, -0.4, -0.6], max: [0.4, 0.4, 0.6] }, [0, 0, 0], room({ floorAt: narrow })).yawDeg, 0, 'a table already long in z stands as it is');
  assert.equal(walk(BOX, [0, 0, 0], room({ floorAt: hall(-1, 1, -12, 12) })), null, 'too narrow either way');
  // its middle turned with it: an off-centre box's translation is its turned middle back from the cell
  const off = placedTableSpot({ min: [0, 0, 0], max: [1.2, 0.8, 0.8] }, [0, 0, 0], room({ floorAt: narrow }));
  assert.deepEqual([off.yawDeg, r6(off.x - off.cx), r6(off.z - off.cz)], [90, -0.4, 0.6], 'Ry(90) takes the middle (0.6, 0.4) to (0.4, -0.6)');
});

test('TAVERN-TABLE another storey is not the entrance\'s: a dais past the slack is no floor to walk; within it, the table stands ON it (AUDIT TAVERN-TABLE L3: on the floor under its top, not the entrance\'s)', () => {
  const dais = (h) => (x) => (x >= 1.25 ? h : 0);
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ floorAt: dais(0.5) })), BACK);
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ floorAt: dais(0.2125) })), { ...AT3, y: 0.6125 }, 'a step of the slack is the same storey - and the table stands on it');
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ floorAt: dais(0.22) })), BACK);
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ floorAt: dais(-0.21) })), { ...AT3, y: 0.19 }, 'below it too');
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ floorAt: dais(-0.22) })), BACK);
  // the entrance on a doorstep: the table stands on the hall's floor, not at the step's height
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ floorAt: (x, z) => (Math.abs(x) < 0.7 && Math.abs(z) < 0.7 ? 0.15 : 0) })), AT3);
  // a floor uneven under its top: the highest of it
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ floorAt: (x) => (x > 3.2 && x < 3.8 ? 0.05 : 0) })), { ...AT3, y: 0.45 });
});

test('TAVERN-TABLE what stands on the floor is in the way: a bench under the head\'s probe, a counter, a beam at the head', () => {
  // a counter 1.1 m tall and deep: its top is met from the head's height (a probe from a metre would pass under it)
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ boxes: [{ min: [1.4, 0, -20], max: [3.6, 1.1, 20] }] })), BACK);
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ boxes: [{ min: [1.4, 0, -20], max: [3.6, 0.45, 20] }] })), BACK, 'a bench: knee-high');
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ boxes: [{ min: [1.4, 1.95, -20], max: [3.6, 2.2, 20] }] })), AT3, 'a beam above the probe is no one\'s way');
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ boxes: [{ min: [1.4, 1.6, -20], max: [3.6, 1.7, 20] }] })), BACK, 'at the head it is');
});

test('TAVERN-TABLE the room\'s doors, people, flats and markers keep the table and its ring clear of them - on the entrance\'s storey', () => {
  const s1 = walk(BOX, [0, 0, 0], room(), [[3, 0, 0, 0.6]]);
  assert.deepEqual(s1, { x: 1, y: 0.4, z: 2, yawDeg: 0, cx: 1, cz: 2 }, 'the first the walk reaches whose ring is clear of the person');
  assert.ok(Math.abs(3 - s1.cx) >= 0.6 + PLACE_RING_M + 0.6 || Math.abs(0 - s1.cz) >= 0.4 + PLACE_RING_M + 0.6, 'outside the ring');
  assert.deepEqual(walk(BOX, [0, 0, 0], room(), [[3, 2.6, 0, 0.6]]), AT3, 'a lamp above the storey');
  assert.deepEqual(walk(BOX, [0, 0, 0], room(), [[3, -2.6, 0, 0.6]]), AT3, 'a room below');
  assert.notDeepEqual(walk(BOX, [0, 0, 0], room(), [[3, 2.5, 0, 0.6]]), AT3, 'at the bound it is in the way');
  // the rect: the table's and its ring's, plus the thing's own reach - 1.95 m from the middle along x
  assert.notDeepEqual(walk(BOX, [0, 0, 0], room(), [[4.95, 0, 0, 0.6]]), AT3);
  assert.deepEqual(walk(BOX, [0, 0, 0], room(), [[4.96, 0, 0, 0.6]]), AT3);
  // exactly touching is clear: a start that sets the grid on the origin, and a box, a ring and a reach all exact in binary
  const exact = placedTableSpot({ min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }, [-PLACE_GRID_OFF[0], 0, -PLACE_GRID_OFF[1]], room(), [[3 + 1.25 + 0.25, 0, 0, 0.25]]);
  assert.deepEqual([exact.cx, exact.cz], [3, 0]);
});

test('TAVERN-TABLE the walk\'s start: an entrance with no floor stands nothing; a marker in a door\'s frame starts beside it, two cells at most', () => {
  assert.equal(walk(BOX, [0, 0, 0], room({ floorAt: () => null })), null);
  assert.equal(walk(BOX, [0, 0, 0], room({ floorAt: () => NaN })), null);
  const post = (r) => ({ min: [-r, 0, -r], max: [r, 3, r] });
  assert.deepEqual(walk(BOX, [0, 0, 0], room({ boxes: [post(0.1)] })), { x: 2.5, y: 0.4, z: -0.5, yawDeg: 0, cx: 2.5, cz: -0.5 }, 'the entrance\'s cell blocked: its first neighbour (-x, -z first) starts the walk');
  assert.ok(walk(BOX, [0, 0, 0], room({ boxes: [post(0.65)] })), 'two cells out');
  assert.equal(walk(BOX, [0, 0, 0], room({ boxes: [post(1.15)] })), null, 'three is too far');
  assert.equal(walk(BOX, [0, -1.5, 0], room()), null, 'the start\'s own floor is looked for a metre over the marker');
});

test('TAVERN-TABLE the walk is bounded: a room past PLACE_REACH_M stands nothing, and the probe is asked once a cell', () => {
  const far = room({ floorAt: (x, z) => (Math.abs(x) <= 0.25 && z >= 0 ? 0 : z >= 14.5 ? 0 : null) });
  assert.equal(walk(BOX, [0, 0, 0], far), null, 'a hall whose ring would need cells past the reach (never read past the grid)');
  const near = room({ floorAt: (x, z) => (Math.abs(x) <= 0.25 && z >= 0 ? 0 : z >= 13 ? 0 : null) });
  assert.deepEqual(walk(BOX, [0, 0, 0], near), { x: 0, y: 0.4, z: 14, yawDeg: 0, cx: 0, cz: 14 }, 'down a corridor to the hall it opens on');
  const r = room({ floorAt: hall(-3, 3, -3, 3) });
  placedTableSpot(BOX, [0, 0, 0], r);
  const side = 2 * Math.round(PLACE_REACH_M / PLACE_CELL) + 1;
  assert.ok(r.calls.floor <= side * side + 1, 'one floor probe a cell (and the start\'s)');
});

test('TAVERN-TABLE every client the same table (AUDIT TAVERN-TABLE M3): a room on the lattice, framed as sixty clients\' worlds are - shifted, every face rounded to float32 - stands one table', () => {
  // a client's frame: the room shifted by T (the streamer's compensation), every face rounded to float32 as a
  // placement's world matrix rounds it, the probe's point in doubles - exactly where a probe on a lattice tie flips
  const framed = (T, floorAt) => {
    const Tf = T.map(Math.fround), w = (v, k) => Math.fround(v + Tf[k]);
    return { floor: (x, y, z) => { const h = floorAt(x + Tf[0], z + Tf[2], w); return h == null ? null : h - Tf[1]; }, open: () => true };
  };
  let seed = 7;
  const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const Ts = Array.from({ length: 60 }, () => [(rand() - 0.5) * 4000, (rand() - 0.5) * 3800, (rand() - 0.5) * 4000]);
  // a floor's edge on a lattice line an un-offset grid's cell would sit on (x = 1.45, from a start at -0.05)
  const edge = (wx, wz, w) => (wx >= w(-1.65, 0) && wx <= w(1.45, 0) && Math.abs(wz - w(0, 2)) <= 10 ? w(0, 1) : null);
  // a dais exactly an on-lattice slack (0.2 m) high
  const dais = (wx, wz, w) => (wx >= w(2.25, 0) ? w(0.2, 1) : w(0, 1));
  for (const [start, floorAt, want] of [[[-0.05, 0, 0], edge, { x: -0.55, y: 0.4, z: 2.5, yawDeg: 90, cx: -0.55, cz: 2.5 }], [[0, 0, 0], dais, { ...AT3, y: 0.6 }]]) {
    // where it stands and how it turns are the walk's decisions - one answer; its height the frame's own floor, to a millimetre
    const got = new Set(Ts.map((T) => { const sp = rel(placedTableSpot(BOX, start, framed(T, floorAt))); return JSON.stringify({ ...sp, y: Math.round(sp.y * 1000) / 1000 }); }));
    assert.deepEqual([...got].map((g) => JSON.parse(g)), [want]);
  }
});

test('TAVERN-TABLE by source: the interior context stands the prop after the room\'s own models and doors, as a model and the one card table, its mesh its own; the host asks for it in every tavern', () => {
  const ic = rd('src/scenes/interiorContext.js');
  const doorsAt = ic.indexOf('dynamicDraws.push({ gpu, object: actions.addDoor(cpu, parent(d.matrix)) });');
  const at = ic.indexOf('if (opts.placeCardTable) {');
  assert.ok(doorsAt > 0 && at > doorsAt, 'after the room\'s own models and its closed doors are in the collider');
  const arm = ic.slice(at, ic.indexOf('// People (C1)', at));
  assert.match(arm, /interior\.markers\.find\(\(m\) => m\.type === INTERIOR_MARKER\.ENTER\) \?\? interior\.markers\.find\(\(m\) => m\.type === INTERIOR_MARKER\.REST\)/, 'the record\'s first enter marker - the same for every client');
  // PIN MOVED (TAVERN-TABLES, world179): the arm stands the room's tables in turn - the chips table, then the gold one
  // (test/taverntables.test.js) - each the next placement index past the record's own, its felt its own, the wood once
  assert.match(arm, /const key = `int:\$\{interior\.placements\.length \+ tables\.length\}`;/, 'the next placement index, past the record\'s own');
  for (const step of [
    'const cpu = cardTablePropModel({ felt });',
    'renderer.uploadTexture(CARD_TABLE_ARCHIVE, felt, paintFelt(gold ? GOLD_FELT_RGB : FELT_RGB), { mips: true, opaque: true });',
    'if (!propMeshes.length) renderer.uploadTexture(CARD_TABLE_ARCHIVE, WOOD_RECORD, paintWood(), { mips: true, opaque: true });',
    'const mesh = renderer.createMesh(cpu);',
    'drawList.push({ mesh, matrix, key, aabb });', 'automapEntries.push({ key, aabb,',
    "collider.addMesh('interior', cpu.positions, cpu.indices, matrix);", 'placedTableSpot(CARD_TABLE_BOX, [enter.x, enter.y, enter.z], probe, avoid)',
    'const matrix = parent(trs(spot.x, spot.y, spot.z, 0, spot.yawDeg, 0));',
    'tables.push({ aabb: worldAabb(corners, matrix), box: { min: [...min], max: [...max] }, matrix, ...(gold ? { gold: true } : {}) });',
  ]) assert.ok(arm.includes(step), `the prop: ${step}`);
  assert.equal(/staticBuilder|_batched/.test(arm), false, 'AUDIT TAVERN-TABLE H1: never in the merge - its string archive is no number to it');
  for (const avoid of ['interior.doors.map(', 'interior.actionDoors.map(', 'collectInteriorPeople(recordData).map(', 'interior.flats.map(', 'interior.markers.map(']) assert.ok(arm.includes(avoid), `kept clear of ${avoid}`);
  assert.equal(ic.split('tables.push(').length - 1, 1, 'the prop is the room\'s one card table: no model of Daggerfall\'s is one');
  assert.ok(ic.includes('for (const mesh of propMeshes.splice(0)) renderer.destroyMesh(mesh);'), 'its mesh freed with the room (EVERY ALLOCATION HAS AN OWNER) - PIN MOVED (TAVERN-TABLES): each of them');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /\n {10}placeCardTable: isTavern\(building\?\.buildingType \?\? BUILDING_TYPES\.None\),\n/);
  // AUDIT TAVERN-TABLE M2: a tavern whose table found no floor still looks once on entering - the relay hands the gold
  // it owes this room's account on a look, table or none (server/src/index.js _holdemOwed)
  assert.ok(wm.includes('if (!cardLooksDue.length && (interiorCtx.tables?.length || inTavern())) cardLooksDue.push(0);'));
  assert.match(rd('server/src/index.js'), /if \(m\.op === 'look'\) \{ msgs = t \? holdemLook\(t, a\.id, now\) : \[\]; await this\._holdemOwed\(ws, a, m\.table\); \}/, 'the relay answers a look at no table with what it owes');
  const call = wm.slice(wm.indexOf('const ctx = await buildInteriorContext('), wm.indexOf('interiorCtx = ctx;'));
  assert.ok(call.includes('placeCardTable:'), 'in the one interior build the hosts share');
  assert.equal(rd('src/scenes/interior.js').includes('placeCardTable'), false, 'the ?interior viewer has no body to seat');
  for (const f of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/dungeonContext.js']) assert.equal(rd(f).includes('placeCardTable'), false, `${f} enters buildings through worldModes`);
});

// THE BUILD: a room of one floor and its enter marker, through the real collider - the context stands the prop, lists
// it, draws it, collides it and frees it; a room not asked stands none.
async function buildRoom(opts) {
  const quad = (x0, x1, z0, z1, y) => ({   // a floor with a classic archive's material, so the room has a merge
    positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]), normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    subMeshes: [{ textureArchive: 67, textureRecord: 0, startIndex: 0, primitiveCount: 2 }],
  });
  const models = new Map([[100, quad(-10, 10, -10, 10, 0)]]);
  const cpuModels = new Map();
  const made = [], freed = [], uploaded = [];
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, createMesh: (m) => { const g = { m }; made.push(g); return g; }, destroyMesh: (g) => freed.push(g),
    uploadTexture: (a, r, c, o) => uploaded.push([a, r, c.width, c.height, o]) };
  const tex = { recordCount: 10, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const deps = { renderer, getGpuMesh: async (id) => { const m = models.get(id); if (!m) return null; cpuModels.set(id, m); return { gpu: id }; }, cpuModels,
    getTexture: () => Promise.resolve(tex), uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null };
  const dfBlock = { name: 'TVRN.RMB', rmbBlock: { subRecords: [{ interior: { header: { num3dObjectRecords: 1 },
    block3dObjectRecords: [{ modelIdNum: 100, objectType: 0, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }],
    blockFlatObjectRecords: [{ xPos: 0, yPos: -20, zPos: 0, textureArchive: 199, textureRecord: 8 }],   // the enter marker, half a metre up
    blockDoorRecords: [], blockSection3Records: [], blockPeopleRecords: [] } }] } };
  const ctx = await buildInteriorContext(deps, dfBlock, 0, 0, 300, 0, null, opts);
  return { ctx, made, freed, uploaded };
}

test('TAVERN-TABLE the build: asked, the room stands the prop on its floor - its textures uploaded, listed, drawn by its own mesh (never the merge), collided, six seats over its stools, freed with the room; not asked, none', async () => {
  const { ctx, made, freed, uploaded } = await buildRoom({ peopleVisible: true, placeCardTable: true });
  // PIN MOVED (TAVERN-TABLES, world179): the room stands two - this pin reads the first, the chips table, where it
  // always stood; the second, the gold table, is test/taverntables.test.js's
  assert.equal(ctx.tables.length, 2);
  const t = ctx.tables[0];
  const [gx, gz] = PLACE_GRID_OFF;
  assert.deepEqual([t.matrix[12] - gx, t.matrix[13], t.matrix[14] - gz].map(r6), [3, 0, 0], 'three metres in, on the floor - its ring\'s edge 1.5 m from the room\'s exit (MAC-BUG1\'s, at the marker), just the 1.5 m that exit keeps');
  assert.equal(r6(t.matrix[0]), 1, 'along x');
  assert.deepEqual({ min: t.box.min.map(r6), max: t.box.max.map(r6) }, { min: [-0.75, 0, -0.5], max: [0.75, 0.802, 0.5] }, 'the table\'s own box, its stools apart, for its seats');
  assert.deepEqual({ min: t.aabb.min.map((v, k) => r6(v - [gx, 0, gz][k])), max: t.aabb.max.map((v, k) => r6(v - [gx, 0, gz][k])) }, { min: [2.25, 0, -0.5], max: [3.75, 0.802, 0.5] }, 'and its world box the table\'s: the press, the frame');
  assert.deepEqual(uploaded, [['cardtable', 'wood', 64, 64, { mips: true, opaque: true }], ['cardtable', 'felt', 64, 64, { mips: true, opaque: true }], ['cardtable', 'feltgold', 64, 64, { mips: true, opaque: true }]]);
  const prop = made.find((g) => g.m.subMeshes?.[0]?.textureArchive === CARD_TABLE_ARCHIVE);
  assert.ok(prop, 'the prop\'s own mesh');
  const entry = ctx.drawList.find((d) => d.mesh === prop);
  assert.ok(entry && entry.matrix === t.matrix && entry.key === 'int:1' && !entry._batched, 'drawn by its own mesh, keyed past the record\'s one placement');
  assert.deepEqual([entry.aabb.min, entry.aabb.max].map((v) => v.map((q, k) => r6(q - [gx, 0, gz][k]))), [[1.73, 0, -1.02], [4.27, 0.802, 1.02]], 'its draw box the whole prop\'s, stools and all');
  // AUDIT TAVERN-TABLE H1: the merge the room draws holds no texture it cannot find - every archive a number
  const merged = ctx.staticBatch.m.subMeshes.map((sm) => [sm.textureArchive, sm.textureRecord]);
  assert.ok(merged.length && merged.every(([a, r]) => Number.isFinite(a) && Number.isFinite(r)), `the merge's sub-meshes: ${JSON.stringify(merged)}`);
  assert.ok(Math.abs(ctx.collider.raycast([3 + gx, 2, gz], [0, -1, 0], 3) - (2 - 0.802)) < 1e-5, 'its felt collides, 0.802 m over the floor');
  assert.ok(Math.abs(ctx.collider.raycast([4.1 + gx, 2, gz], [0, -1, 0], 3) - (2 - 0.48)) < 1e-5, 'and the end stool, 0.48 m');
  const c = ctx.collider;
  const seatProbe = (from, to) => {   // the interior host's own (worldModes.js seatProbe)
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (!(len > 0) || c.raycast(from, [d[0] / len, d[1] / len, d[2] / len], len) < len) return false;
    return seatFloorOk(c.raycast(to, [0, -1, 0], SEAT_FLOOR_PROBE));
  };
  const seats = cardTableSeats(t, seatProbe);
  assert.equal(seats.length, HOLDEM_SEATS_MAX, 'six seats: the legs and the top stand in none of their ways');
  for (const st of seats) assert.ok(Math.abs(c.raycast(st.eye, [0, -1, 0], SEAT_FLOOR_PROBE) - (SEATED_EYE_HEIGHT - 0.48)) < 1e-5, 'each over its stool, not the floor');
  ctx.destroy();
  assert.ok(freed.includes(prop), 'its mesh freed with the room');
  const bare = await buildRoom({ peopleVisible: true });
  assert.deepEqual([bare.ctx.tables.length, bare.uploaded.length, bare.ctx.drawList.length], [0, 0, 1]);
  bare.ctx.destroy();
});
