// GOTHWAY-TABLE (2026-10-08, the owner: "Put a table in gothway tavern"; bible/11-Multiplayer/Tavern-Cards.md section
// 28): a card table stood in Gothway Garden's taverns - the floor found from the entrance (world/placedCardTable.js,
// pure), the table stood as one of the room's own models and card tables (scenes/interiorContext.js), asked for by the
// interior host for a tavern in Gothway Garden alone (scenes/worldModes.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  placedTableSpot, PLACED_CARD_TABLE_MODEL, PLACE_CELL, PLACE_REACH_M, PLACE_FROM_DOOR_M, PLACE_RING_M, PLACE_BODY_R,
  PLACE_CLEAR_HEIGHTS, PLACE_STOREY_SLACK, PLACE_PROBE_M, PLACE_AVOID_DY,
} from '../src/world/placedCardTable.js';
import { isCardTableModel, SEAT_SPACING, cardTableSeats, seatFloorOk, SEAT_FLOOR_PROBE } from '../src/world/cardTables.js';
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

test('GOTHWAY-TABLE the numbers: the one nameable table, the walk\'s cell and reach, the threshold, the ring a seated body needs (SEAT_OUT and a body), the body\'s clear, the storey\'s slack', () => {
  assert.equal(PLACED_CARD_TABLE_MODEL, 41130);
  assert.equal(isCardTableModel(PLACED_CARD_TABLE_MODEL), true, 'the placed table is a card table to the room\'s own test');
  assert.deepEqual({ PLACE_CELL, PLACE_REACH_M, PLACE_FROM_DOOR_M, PLACE_BODY_R, PLACE_CLEAR_HEIGHTS: [...PLACE_CLEAR_HEIGHTS], PLACE_STOREY_SLACK, PLACE_PROBE_M, PLACE_AVOID_DY },
    { PLACE_CELL: 0.5, PLACE_REACH_M: 16, PLACE_FROM_DOOR_M: 3, PLACE_BODY_R: 0.3, PLACE_CLEAR_HEIGHTS: [0.6, 1.5], PLACE_STOREY_SLACK: 0.2, PLACE_PROBE_M: 1.9, PLACE_AVOID_DY: 2.5 });
  assert.equal(PLACE_RING_M, SEAT_OUT + 0.45);
  assert.ok(PLACE_RING_M * 2 + 1.2 >= 2 * SEAT_SPACING, 'a 1.2 m side seats one at least, with its ring clear');
});

test('GOTHWAY-TABLE an open floor: the first cell the walk reaches PLACE_FROM_DOOR_M in (+x first), the table\'s lowest point on the floor and its middle on the cell', () => {
  assert.deepEqual(placedTableSpot(BOX, [0, 0.5, 0], room()), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 });
  // a box off its origin: the translation stands its middle on the cell and its bottom on the floor
  assert.deepEqual(placedTableSpot({ min: [0, 0, 0], max: [1.2, 0.8, 0.8] }, [1, 0, 2], room({ floorAt: () => 0.25 })),
    { x: 3.4, y: 0.25, z: 1.6, cx: 4, cz: 2 });
});

test('GOTHWAY-TABLE nearest by the WALK, not the crow: a wall beside the entrance turns it the other way, and the ring keeps its cells off the wall', () => {
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

test('GOTHWAY-TABLE another storey is not the entrance\'s: a dais past the slack is no floor to walk, a sill within it is', () => {
  const dais = (h) => (x) => (x >= 1.25 ? h : 0);
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: dais(0.5) })), { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 });
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: dais(0.2) })), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 }, 'a step of the slack is the same floor');
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: dais(-0.21) })), { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 }, 'below it too');
});

test('GOTHWAY-TABLE what stands on the floor is in the way: a bench under the head\'s probe, a counter, a beam at the head', () => {
  // a counter 1.1 m tall and deep: its top is met from the head's height (a probe from a metre would pass under it)
  const counter = { min: [1.4, 0, -20], max: [3.6, 1.1, 20] };
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [counter] })), { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 });
  // a bench: knee-high
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [{ min: [1.4, 0, -20], max: [3.6, 0.45, 20] }] })), { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 });
  // a beam at the head (no floor under it is blocked, but the body's head height is)
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [{ min: [1.4, 1.95, -20], max: [3.6, 2.2, 20] }] })), { x: 3, y: 0.4, z: 0, cx: 3, cz: 0 }, 'above the probe is no one\'s way');
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [{ min: [1.4, 1.6, -20], max: [3.6, 1.7, 20] }] })), { x: -3, y: 0.4, z: 0, cx: -3, cz: 0 }, 'at the head it is');
});

test('GOTHWAY-TABLE the room\'s doors, people, flats and markers keep the table and its ring clear of them - on the entrance\'s storey', () => {
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

test('GOTHWAY-TABLE the walk\'s start: an entrance with no floor stands nothing; a marker in a door\'s frame starts beside it, two cells at most', () => {
  assert.equal(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: () => null })), null);
  assert.equal(placedTableSpot(BOX, [0, 0, 0], room({ floorAt: () => NaN })), null);
  const post = (r) => ({ min: [-r, 0, -r], max: [r, 3, r] });
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [post(0.1)] })), { x: 2.5, y: 0.4, z: -0.5, cx: 2.5, cz: -0.5 }, 'the entrance\'s cell blocked: its first neighbour (-x, -z first) starts the walk');
  assert.ok(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [post(0.65)] })), 'two cells out');
  assert.equal(placedTableSpot(BOX, [0, 0, 0], room({ boxes: [post(1.15)] })), null, 'three is too far');
  // the start's own floor is looked for a metre over the marker
  assert.equal(placedTableSpot(BOX, [0, -1.5, 0], room()), null, 'a floor above the marker\'s metre is not its floor');
});

test('GOTHWAY-TABLE the walk is bounded: a room past PLACE_REACH_M stands nothing, and the probe is asked once a cell', () => {
  const far = room({ floorAt: (x, z) => (Math.abs(x) <= 0.25 && z >= 0 ? 0 : z >= 14.5 ? 0 : null) });
  assert.equal(placedTableSpot(BOX, [0, 0, 0], far), null, 'a hall whose ring would need cells past the reach (never read past the grid)');
  const near = room({ floorAt: (x, z) => (Math.abs(x) <= 0.25 && z >= 0 ? 0 : z >= 13 ? 0 : null) });
  assert.deepEqual(placedTableSpot(BOX, [0, 0, 0], near), { x: 0, y: 0.4, z: 14.5, cx: 0, cz: 14.5 }, 'down a corridor to the hall it opens on');
  const r = room({ floorAt: hall(-3, 3, -3, 3) });
  placedTableSpot(BOX, [0, 0, 0], r);
  const side = 2 * Math.round(PLACE_REACH_M / PLACE_CELL) + 1;
  assert.ok(r.calls.floor <= side * side + 1, 'one floor probe a cell (and the start\'s)');
});

test('GOTHWAY-TABLE by source: the interior context stands the placed table after the room\'s own and its doors, as a model and a card table; the host asks for it in a Gothway tavern alone', () => {
  const ic = rd('src/scenes/interiorContext.js');
  assert.match(ic, /if \(opts\.placeCardTable\) ids\.add\(PLACED_CARD_TABLE_MODEL\);/, 'its model collected with the room\'s, climate-swapped with them');
  const doorsAt = ic.indexOf('dynamicDraws.push({ gpu, object: actions.addDoor(cpu, parent(d.matrix)) });');
  const at = ic.indexOf('if (opts.placeCardTable) {');
  assert.ok(doorsAt > 0 && at > doorsAt, 'after the room\'s own tables and its closed doors are in the collider');
  const arm = ic.slice(at, ic.indexOf('// People (C1)', at));
  assert.match(arm, /interior\.markers\.find\(\(m\) => m\.type === INTERIOR_MARKER\.ENTER\) \?\? interior\.markers\.find\(\(m\) => m\.type === INTERIOR_MARKER\.REST\)/, 'the record\'s first enter marker - the same for every client');
  assert.match(arm, /const key = `int:\$\{interior\.placements\.length\}`;/, 'the next placement index, past the record\'s own');
  for (const step of ['drawList.push({ mesh: gpu, matrix, key, aabb });', 'staticBuilder.add(cpu, matrix, resolveTexKey);', 'automapEntries.push({ key, aabb,', "collider.addMesh('interior', cpu.positions, cpu.indices, matrix);", 'tables.push({ aabb, box: { min: b.slice(0, 3), max: b.slice(3) }, matrix, modelIdNum: id });']) {
    assert.ok(arm.includes(step), `the placed table: ${step}`);
  }
  for (const avoid of ['interior.doors.map(', 'interior.actionDoors.map(', 'collectInteriorPeople(recordData).map(', 'interior.flats.map(', 'interior.markers.map(']) assert.ok(arm.includes(avoid), `kept clear of ${avoid}`);
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /placeCardTable: isTavern\(building\?\.buildingType \?\? BUILDING_TYPES\.None\) && isGothwayGarden\(hit\.dfLocation\?\.name\),/);
  const call = wm.slice(wm.indexOf('const ctx = await buildInteriorContext('), wm.indexOf('interiorCtx = ctx;'));
  assert.ok(call.includes('placeCardTable:'), 'in the one interior build the hosts share');
  assert.equal(rd('src/scenes/interior.js').includes('placeCardTable'), false, 'the ?interior viewer has no body to seat');
  for (const f of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/dungeonContext.js']) assert.equal(rd(f).includes('placeCardTable'), false, `${f} enters buildings through worldModes`);
});

// THE BUILD: a room of one floor, its enter marker, and the placed table's model - the context lists the table, draws it
// and collides it; a room not asked stands none.
async function buildRoom(opts) {
  const quad = (x0, x1, z0, z1, y) => ({ positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [] });
  const tableModel = {
    positions: new Float32Array([-0.6, -0.4, -0.4, 0.6, -0.4, -0.4, 0.6, 0.4, 0.4, -0.6, 0.4, 0.4, -0.6, 0.4, -0.4, 0.6, 0.4, -0.4]),
    indices: new Uint32Array([3, 2, 5, 3, 5, 4]), subMeshes: [],
  };
  const models = new Map([[100, quad(-10, 10, -10, 10, 0)], [PLACED_CARD_TABLE_MODEL, tableModel]]);
  const cpuModels = new Map();
  const asked = [];
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, destroyMesh: () => {}, createMesh: () => ({}) };
  const tex = { recordCount: 10, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const deps = { renderer, getGpuMesh: async (id) => { asked.push(id); const m = models.get(id); if (!m) return null; cpuModels.set(id, m); return { gpu: id }; }, cpuModels,
    getTexture: () => Promise.resolve(tex), uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null };
  const dfBlock = { name: 'TVRN.RMB', rmbBlock: { subRecords: [{ interior: { header: { num3dObjectRecords: 1 },
    block3dObjectRecords: [{ modelIdNum: 100, objectType: 0, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }],
    blockFlatObjectRecords: [{ xPos: 0, yPos: -20, zPos: 0, textureArchive: 199, textureRecord: 8 }],   // the enter marker, half a metre up
    blockDoorRecords: [], blockSection3Records: [], blockPeopleRecords: [] } }] } };
  const ctx = await buildInteriorContext(deps, dfBlock, 0, 0, 300, 0, null, opts);
  return { ctx, asked };
}

test('GOTHWAY-TABLE the build: asked, the room stands the table on its floor - listed, drawn, collided, on the automap; not asked, none and its model never fetched', async () => {
  const { ctx, asked } = await buildRoom({ peopleVisible: true, placeCardTable: true });
  assert.equal(ctx.tables.length, 1);
  const t = ctx.tables[0];
  assert.equal(t.modelIdNum, PLACED_CARD_TABLE_MODEL);
  assert.deepEqual([t.matrix[12], t.matrix[13], t.matrix[14]].map((v) => Math.round(v * 1e6) / 1e6), [3, 0.4, 0], 'three metres in, its lowest point on the floor');
  const r6 = (a) => a.map((v) => Math.round(v * 1e6) / 1e6);
  assert.deepEqual({ min: r6(t.box.min), max: r6(t.box.max) }, { min: [-0.6, -0.4, -0.4], max: [0.6, 0.4, 0.4] }, 'its own box, for its seats');
  assert.ok(ctx.drawList.some((d) => d.matrix === t.matrix && d.key === 'int:1'), 'drawn, keyed past the record\'s one placement');
  assert.ok(Math.abs(ctx.collider.raycast([3, 2, 0], [0, -1, 0], 3) - 1.2) < 1e-6, 'its top collides, 0.8 m over the floor');
  // the seats round it, through the interior host's own probe (worldModes.js seatProbe) over the room's collider
  const c = ctx.collider;
  const seatProbe = (from, to) => {
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (!(len > 0) || c.raycast(from, [d[0] / len, d[1] / len, d[2] / len], len) < len) return false;
    return seatFloorOk(c.raycast(to, [0, -1, 0], SEAT_FLOOR_PROBE));
  };
  assert.equal(cardTableSeats(t, seatProbe).length, 4, 'a seat on each side of a 1.2 by 0.8 table: a card table to the host');
  ctx.destroy();
  const bare = await buildRoom({ peopleVisible: true });
  assert.equal(bare.ctx.tables.length, 0);
  assert.equal(bare.asked.includes(PLACED_CARD_TABLE_MODEL), false);
  assert.equal(bare.ctx.drawList.length, 1);
  bare.ctx.destroy();
});
