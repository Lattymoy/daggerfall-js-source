// TAVERN-TABLE (2026-10-08, the owner: "Lets instead place a specific table in each inn. A new property specifficaly
// used for the card table"; bible/11-Multiplayer/Tavern-Cards.md section 28): every tavern stands the card table's own
// prop (world/cardTableProp.js, pure: its model and its painted felt and wood), on floor found from the entrance
// (world/placedCardTable.js, pure), as one of the room's own models and its one card table (scenes/interiorContext.js),
// asked for by the interior host for a tavern (scenes/worldModes.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  placedTableSpot, PLACE_CELL, PLACE_REACH_M, PLACE_FROM_DOOR_M, PLACE_RING_M, PLACE_BODY_R,
  PLACE_CLEAR_HEIGHTS, PLACE_STOREY_SLACK, PLACE_PROBE_M, PLACE_AVOID_DY,
} from '../src/world/placedCardTable.js';
import { SEAT_SPACING, cardTableSeats, seatFloorOk, SEAT_FLOOR_PROBE, tableFrame } from '../src/world/cardTables.js';
import {
  cardTablePropModel, paintFelt, paintWood, texelNoise, CARD_TABLE_ARCHIVE, FELT_RECORD, WOOD_RECORD, CARD_TABLE_W, CARD_TABLE_D,
  CARD_TABLE_TOP, CARD_TABLE_SLAB, CARD_TABLE_RAIL, CARD_TABLE_FELT_LIFT, CARD_TABLE_LEG, CARD_TABLE_LEG_IN, WOOD_TILE_M,
  CARD_TABLE_TEX, FELT_RGB, WOOD_RGB,
} from '../src/world/cardTableProp.js';
import { cardModel } from '../src/render/cardTableDraw.js';
import { localAabb } from '../src/render/frustum.js';
import { HOLDEM_SEATS_MAX } from '../src/net/cardLaw.js';
import { SEAT_OUT } from '../src/player/seatPose.js';
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

test('TAVERN-TABLE the walk\'s numbers: its cell and reach, the threshold, the ring a seated body needs (SEAT_OUT and a body), the body\'s clear, the storey\'s slack', () => {
  assert.deepEqual({ PLACE_CELL, PLACE_REACH_M, PLACE_FROM_DOOR_M, PLACE_BODY_R, PLACE_CLEAR_HEIGHTS: [...PLACE_CLEAR_HEIGHTS], PLACE_STOREY_SLACK, PLACE_PROBE_M, PLACE_AVOID_DY },
    { PLACE_CELL: 0.5, PLACE_REACH_M: 16, PLACE_FROM_DOOR_M: 3, PLACE_BODY_R: 0.3, PLACE_CLEAR_HEIGHTS: [0.6, 1.5], PLACE_STOREY_SLACK: 0.2, PLACE_PROBE_M: 1.9, PLACE_AVOID_DY: 2.5 });
  assert.equal(PLACE_RING_M, SEAT_OUT + 0.45);
  assert.ok(PLACE_RING_M * 2 + 1.2 >= 2 * SEAT_SPACING, 'a 1.2 m side seats one at least, with its ring clear');
});

// ── THE PROP ────────────────────────────────────────────────────────────────────────────────────────────────────────
const r6 = (v) => Math.round(v * 1e6) / 1e6;

test('TAVERN-TABLE the prop\'s numbers: a poker table 1.5 by 1 m, its top at 0.76 m, a 7 cm rail round the felt, four legs; its two textures in its own archive', () => {
  assert.deepEqual({ CARD_TABLE_W, CARD_TABLE_D, CARD_TABLE_TOP, CARD_TABLE_SLAB, CARD_TABLE_RAIL, CARD_TABLE_FELT_LIFT, CARD_TABLE_LEG, CARD_TABLE_LEG_IN, WOOD_TILE_M, CARD_TABLE_TEX },
    { CARD_TABLE_W: 1.5, CARD_TABLE_D: 1, CARD_TABLE_TOP: 0.76, CARD_TABLE_SLAB: 0.06, CARD_TABLE_RAIL: 0.07, CARD_TABLE_FELT_LIFT: 0.002, CARD_TABLE_LEG: 0.07, CARD_TABLE_LEG_IN: 0.1, WOOD_TILE_M: 0.5, CARD_TABLE_TEX: 64 });
  assert.deepEqual([CARD_TABLE_ARCHIVE, FELT_RECORD, WOOD_RECORD, [...FELT_RGB], [...WOOD_RGB]], ['cardtable', 'felt', 'wood', [31, 90, 55], [107, 66, 38]]);
});

test('TAVERN-TABLE the prop\'s model: its lowest point on the floor and its footprint\'s middle on the origin, the felt flush on top, the wood\'s triangles then the felt\'s', () => {
  const m = cardTablePropModel();
  assert.deepEqual(Array.from(localAabb(m.positions), r6), [-0.75, 0, -0.5, 0.75, 0.762, 0.5], 'the felt is the top: the cards lie on it');
  assert.deepEqual(m.subMeshes, [
    { textureArchive: 'cardtable', textureRecord: 'wood', startIndex: 0, primitiveCount: 12 + 4 * 10 },
    { textureArchive: 'cardtable', textureRecord: 'felt', startIndex: 156, primitiveCount: 2 },
  ], 'the slab\'s six faces, the legs\' five each (no top under the slab), the felt\'s one');
  assert.equal(m.indices.length, 3 * (52 + 2));
  assert.equal(m.positions.length / 3, m.normals.length / 3);
  assert.equal(m.positions.length / 3, m.uvs.length / 2);
  // the felt: inside the rail, a hair over the wood
  const felt = Array.from(m.indices.slice(156)).map((i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]].map(r6));
  assert.deepEqual([...new Set(felt.map((p) => p.join(',')))].sort(), ['-0.68,0.762,-0.43', '-0.68,0.762,0.43', '0.68,0.762,-0.43', '0.68,0.762,0.43']);
  // the legs: 7 cm square, 10 cm in from each corner, standing on the floor up to the slab's underside
  const low = new Set();
  for (let i = 0; i < m.positions.length / 3; i++) if (m.positions[i * 3 + 1] === 0) low.add([m.positions[i * 3], m.positions[i * 3 + 2]].map(r6).join(','));
  assert.deepEqual([...low].sort(), ['-0.58,-0.33', '-0.58,-0.4', '-0.65,-0.33', '-0.65,-0.4', '-0.58,0.33', '-0.58,0.4', '-0.65,0.33', '-0.65,0.4',
    '0.58,-0.33', '0.58,-0.4', '0.65,-0.33', '0.65,-0.4', '0.58,0.33', '0.58,0.4', '0.65,0.33', '0.65,0.4'].sort());
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
  // the uvs: the felt across its texture once, the wood tiled every WOOD_TILE_M
  const m = cardTablePropModel();
  assert.deepEqual(Array.from(m.uvs.slice(0, 8), r6), [0, 0, 3, 0, 3, 2, 0, 2], 'the slab\'s top, 1.5 by 1 m');
  assert.deepEqual(Array.from(m.uvs.slice(-8), r6), [0, 0, 1, 0, 1, 1, 0, 1]);
});

test('TAVERN-TABLE the prop seats six round its own box - two a long side, one an end - and its frame lies along its length', () => {
  const m = cardTablePropModel();
  const b = localAabb(m.positions), box = { min: [b[0], b[1], b[2]], max: [b[3], b[4], b[5]] };
  const seats = cardTableSeats({ aabb: box, box }, () => true);
  assert.equal(seats.length, HOLDEM_SEATS_MAX);
  assert.deepEqual(seats.map((s) => s.side), ['+x', '-x', '+z', '+z', '-z', '-z']);
  const f = tableFrame({ aabb: box, box });
  assert.deepEqual([f.halfLong, f.halfShort].map(r6), [0.75, 0.5]);
  assert.equal(r6(f.centre[1]), 0.762, 'the cards lie on the felt');
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

test('TAVERN-TABLE an open floor: the first cell the walk reaches PLACE_FROM_DOOR_M in (+x first), the table\'s lowest point on the floor and its middle on the cell', () => {
  assert.deepEqual(placedTableSpot(BOX, [0, 0.5, 0], room()), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 });
  // a box off its origin: the translation stands its middle on the cell and its bottom on the floor
  assert.deepEqual(placedTableSpot({ min: [0, 0, 0], max: [1.2, 0.8, 0.8] }, [1, 0, 2], room({ floorAt: () => 0.25 })),
    { x: 3.4, y: 0.25, z: 1.6, cx: 4, cz: 2 });
});

test('TAVERN-TABLE nearest by the WALK, not the crow: a wall beside the entrance turns it the other way, and the ring keeps its cells off the wall', () => {
  const wall = { min: [1.4, 0, -20], max: [1.6, 3, 20] };
  const s = placedTableSpot(BOX, [0, 0, 0], room({ boxes: [wall] }));
  assert.deepEqual(s, { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 });
  // a wall with a doorway: the room beyond is walked to, but a spot this side comes first
  const gap = [{ min: [1.4, 0, -20], max: [1.6, 3, -0.6] }, { min: [1.4, 0, 0.6], max: [1.6, 3, 20] }];
  const g = placedTableSpot(BOX, [0, 0, 0], room({ boxes: gap }));
  assert.ok(g.cx + 0.6 + PLACE_RING_M <= 1.4 || g.cx - 0.6 - PLACE_RING_M >= 1.6, 'the table and its ring stand on one side of the wall');
  // the ring: a room whose open floor is one cell short of it stands nothing; a cell more and it stands
  assert.equal(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: hall(-0.5, 4.0, -1.5, 1.5) })), null);
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: hall(-0.5, 4.5, -1.5, 1.5) })), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 });
});

test('TAVERN-TABLE another storey is not the entrance\'s: a dais past the slack is no floor to walk, a sill within it is', () => {
  const dais = (h) => (x) => (x >= 1.25 ? h : 0);
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: dais(0.5) })), { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 });
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: dais(0.2) })), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 }, 'a step of the slack is the same floor');
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: dais(-0.21) })), { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 }, 'below it too');
});

test('TAVERN-TABLE what stands on the floor is in the way: a bench under the head\'s probe, a counter, a beam at the head', () => {
  // a counter 1.1 m tall and deep: its top is met from the head's height (a probe from a metre would pass under it)
  const counter = { min: [1.4, 0, -20], max: [3.6, 1.1, 20] };
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [counter] })), { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 });
  // a bench: knee-high
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [{ min: [1.4, 0, -20], max: [3.6, 0.45, 20] }] })), { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 });
  // a beam at the head (no floor under it is blocked, but the body's head height is)
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [{ min: [1.4, 1.95, -20], max: [3.6, 2.2, 20] }] })), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 }, 'above the probe is no one\'s way');
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [{ min: [1.4, 1.6, -20], max: [3.6, 1.7, 20] }] })), { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 }, 'at the head it is');
});

test('TAVERN-TABLE the room\'s doors, people, flats and markers keep the table and its ring clear of them - on the entrance\'s storey', () => {
  const s = placedTableSpot(BOX, [0, 0, 0], room(), [[3, 0, 0, 0.6]]);
  assert.notDeepEqual(s, { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 });
  assert.ok(Math.abs(3 - s.cx) >= 0.6 + PLACE_RING_M + 0.6 || Math.abs(0 - s.cz) >= 0.4 + PLACE_RING_M + 0.6, 'outside the ring');
  assert.deepEqual(s, { x: 1, y: 0.4, z: 2, cx: 1, cz: 2 }, 'the first the walk reaches whose ring is clear of the person');
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room(), [[3, 2.6, 0, 0.6]]), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 }, 'a lamp above the storey');
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room(), [[3, -2.6, 0, 0.6]]), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 }, 'a room below');
  assert.notDeepEqual(placedTableSpot(BOX, [0, 0, 0], room(), [[3, 2.5, 0, 0.6]]), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 }, 'at the bound it is in the way');
  assert.notDeepEqual(placedTableSpot(BOX, [0, 0, 0], room(), [[4.99, 0, 0, 0.6]]), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 }, 'the rect is the table\'s and its ring\'s, plus the thing\'s own reach');
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room(), [[5.01, 0, 0, 0.6]]), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 });
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room(), [[5, 0, 0, 0.6]]), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 }, 'just touching is clear');
});

test('TAVERN-TABLE the walk\'s start: an entrance with no floor stands nothing; a marker in a door\'s frame starts beside it, two cells at most', () => {
  assert.equal(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: () => null })), null);
  assert.equal(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: () => NaN })), null);
  const post = (r) => ({ min: [-r, 0, -r], max: [r, 3, r] });
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [post(0.1)] })), { x: 2.5, y: 0.4, z: -0.5, cx: 2.5, cz: -0.5 }, 'the entrance\'s cell blocked: its first neighbour (-x, -z first) starts the walk');
  assert.ok(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [post(0.65)] })), 'two cells out');
  assert.equal(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [post(1.15)] })), null, 'three is too far');
  // the start's own floor is looked for a metre over the marker
  assert.equal(placedTableSpot(BOX, [0, -1.5, 0], room()), null, 'a floor above the marker\'s metre is not its floor');
});

test('TAVERN-TABLE the walk is bounded: a room past PLACE_REACH_M stands nothing, and the probe is asked once a cell', () => {
  const far = room({ floorAt: (x, z) => (Math.abs(x) <= 0.25 && z >= 0 ? 0 : z >= 14.5 ? 0 : null) });
  assert.equal(placedTableSpot(BOX, [0, 0, 0], far), null, 'a hall whose ring would need cells past the reach (never read past the grid)');
  const near = room({ floorAt: (x, z) => (Math.abs(x) <= 0.25 && z >= 0 ? 0 : z >= 13 ? 0 : null) });
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], near), { x: 0, y: 0.4, z: 14.5, cx: 0, cz: 14.5 }, 'down a corridor to the hall it opens on');
  const r = room({ floorAt: hall(-3, 3, -3, 3) });
  placedTableSpot(BOX, [0, 0, 0], r);
  const side = 2 * Math.round(PLACE_REACH_M / PLACE_CELL) + 1;
  assert.ok(r.calls.floor <= side * side + 1, 'one floor probe a cell (and the start\'s)');
});

test('TAVERN-TABLE by source: the interior context stands the prop after the room\'s own models and doors, as a model and the one card table, its mesh its own; the host asks for it in every tavern', () => {
  const ic = rd('src/scenes/interiorContext.js');
  const doorsAt = ic.indexOf('dynamicDraws.push({ gpu, object: actions.addDoor(cpu, parent(d.matrix)) });');
  const at = ic.indexOf('if (opts.placeCardTable) {');
  assert.ok(doorsAt > 0 && at > doorsAt, 'after the room\'s own models and its closed doors are in the collider');
  const arm = ic.slice(at, ic.indexOf('// People (C1)', at));
  assert.match(arm, /interior\.markers\.find\(\(m\) => m\.type === INTERIOR_MARKER\.ENTER\) \?\? interior\.markers\.find\(\(m\) => m\.type === INTERIOR_MARKER\.REST\)/, 'the record\'s first enter marker - the same for every client');
  assert.match(arm, /const key = `int:\$\{interior\.placements\.length\}`;/, 'the next placement index, past the record\'s own');
  for (const step of [
    'const cpu = cardTablePropModel();',
    'renderer.uploadTexture(CARD_TABLE_ARCHIVE, FELT_RECORD, paintFelt(), { mips: true, opaque: true });',
    'renderer.uploadTexture(CARD_TABLE_ARCHIVE, WOOD_RECORD, paintWood(), { mips: true, opaque: true });',
    'propMesh = renderer.createMesh(cpu);',
    'drawList.push({ mesh: propMesh, matrix, key, aabb });', 'staticBuilder.add(cpu, matrix, resolveTexKey);', 'automapEntries.push({ key, aabb,',
    "collider.addMesh('interior', cpu.positions, cpu.indices, matrix);", 'tables.push({ aabb, box: { min: b.slice(0, 3), max: b.slice(3) }, matrix });',
  ]) assert.ok(arm.includes(step), `the prop: ${step}`);
  for (const avoid of ['interior.doors.map(', 'interior.actionDoors.map(', 'collectInteriorPeople(recordData).map(', 'interior.flats.map(', 'interior.markers.map(']) assert.ok(arm.includes(avoid), `kept clear of ${avoid}`);
  assert.equal(ic.split('tables.push(').length - 1, 1, 'the prop is the room\'s one card table: no model of Daggerfall\'s is one');
  assert.match(ic, /if \(propMesh\) \{ renderer\.destroyMesh\(propMesh\); propMesh = null; \}/, 'its mesh freed with the room (EVERY ALLOCATION HAS AN OWNER)');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /\n {10}placeCardTable: isTavern\(building\?\.buildingType \?\? BUILDING_TYPES\.None\),\n/);
  const call = wm.slice(wm.indexOf('const ctx = await buildInteriorContext('), wm.indexOf('interiorCtx = ctx;'));
  assert.ok(call.includes('placeCardTable:'), 'in the one interior build the hosts share');
  assert.equal(rd('src/scenes/interior.js').includes('placeCardTable'), false, 'the ?interior viewer has no body to seat');
  for (const f of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/dungeonContext.js']) assert.equal(rd(f).includes('placeCardTable'), false, `${f} enters buildings through worldModes`);
});

// THE BUILD: a room of one floor and its enter marker, through the real collider - the context stands the prop, lists
// it, draws it, collides it and frees it; a room not asked stands none.
async function buildRoom(opts) {
  const quad = (x0, x1, z0, z1, y) => ({ positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [] });
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

test('TAVERN-TABLE the build: asked, the room stands the prop on its floor - its textures uploaded, listed, drawn, merged, collided, six seats round it, freed with the room; not asked, none', async () => {
  const { ctx, made, freed, uploaded } = await buildRoom({ peopleVisible: true, placeCardTable: true });
  assert.equal(ctx.tables.length, 1);
  const t = ctx.tables[0];
  assert.deepEqual([t.matrix[12], t.matrix[13], t.matrix[14]].map(r6), [0, 0, 3], 'three metres in, on the floor - +z, not +x: at +x its 1.5 m would stand within the 1.5 m the room\'s exit keeps (MAC-BUG1\'s, at the marker)');
  assert.deepEqual({ min: t.box.min.map(r6), max: t.box.max.map(r6) }, { min: [-0.75, 0, -0.5], max: [0.75, 0.762, 0.5] }, 'its own box, for its seats');
  assert.deepEqual(uploaded, [['cardtable', 'felt', 64, 64, { mips: true, opaque: true }], ['cardtable', 'wood', 64, 64, { mips: true, opaque: true }]]);
  const prop = made.find((g) => g.m.subMeshes?.[0]?.textureArchive === CARD_TABLE_ARCHIVE);
  assert.ok(prop, 'the prop\'s own mesh');
  assert.ok(ctx.drawList.some((d) => d.mesh === prop && d.matrix === t.matrix && d.key === 'int:1' && d._batched), 'drawn in the merge, keyed past the record\'s one placement');
  assert.ok(Math.abs(ctx.collider.raycast([0, 2, 3], [0, -1, 0], 3) - (2 - 0.762)) < 1e-5, 'its felt collides, 0.762 m over the floor');
  const c = ctx.collider;
  const seatProbe = (from, to) => {   // the interior host's own (worldModes.js seatProbe)
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (!(len > 0) || c.raycast(from, [d[0] / len, d[1] / len, d[2] / len], len) < len) return false;
    return seatFloorOk(c.raycast(to, [0, -1, 0], SEAT_FLOOR_PROBE));
  };
  assert.equal(cardTableSeats(t, seatProbe).length, HOLDEM_SEATS_MAX, 'six seats: the legs and the top stand in none of their ways');
  ctx.destroy();
  assert.ok(freed.includes(prop), 'its mesh freed with the room');
  const bare = await buildRoom({ peopleVisible: true });
  assert.deepEqual([bare.ctx.tables.length, bare.uploaded.length, bare.ctx.drawList.length], [0, 0, 1]);
  bare.ctx.destroy();
});
