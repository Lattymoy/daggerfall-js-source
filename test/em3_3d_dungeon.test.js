// EM3-3D: the solid dungeon map - the model, the turned space, and the sheet's orbit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSolid, orbitFrame, toSheet, fromSheet, easeOrbit, ORBIT, SOLID, ORBIT_BUTTONS } from '../src/ui/inkDungeonSolid.js';
import { createAutomapSheet } from '../src/ui/automapSheet.js';
import { levelField, deriveFloors, floorTriangles, planBounds } from '../src/systems/automapFloors.js';

const row = (key, y, x0, z0, x1, z1) => ({
  key, aabb: { min: [x0, y, z0], max: [x1, y, z1] },
  positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]), matrix: null,
});
const LEVEL = [row('a', 0, 0, 0, 8, 6), row('b', 0, 8, 2, 16, 4)];
const rec = (keys) => ({ revealed: new Set(keys), visitedThisRun: new Set(), entranceDiscovered: false, notes: new Map(), teleporters: new Map() });

test('EM3-3D: revealed floor stands at its own height, walled a cell thick and cut a rise above it', () => {
  const floors = deriveFloors(floorTriangles(LEVEL));
  const field = levelField(LEVEL, floors, { bounds: planBounds(floorTriangles(LEVEL), 1) });
  const m = buildSolid(field, [0], { revealed: new Uint8Array([1, 1]) });
  assert.ok(m.flat.length > 0, 'the open floor is laid flat');
  const walls = m.cols.filter((c) => c.k === 2);
  assert.ok(walls.length > 0, 'the rock round it is wall');
  for (const w of walls) assert.ok(Math.abs(w.top - SOLID.wallRise) < 1e-4, 'cut a rise above the floor it touches');
  // an unseen row is an opening, not a wall
  const half = buildSolid(field, [0], { revealed: new Uint8Array([1, 0]) });
  assert.ok(half.slabs.some((s) => s.open), 'the edge onto floor not yet seen is left open');
});

test('EM3-3D: at plan tilt and no turn the turned space is the flat plan, and a point survives the round trip', () => {
  const fr = orbitFrame(20, 10, 0, Math.PI / 2);
  const [U] = toSheet(fr, 5, 3, 0, 0);
  assert.ok(Math.abs(U - 5) < 1e-6, 'east is east at yaw 0');
  const turned = orbitFrame(20, 10, 0.7, 0.9);
  const [u2, v2] = toSheet(turned, 12, 4, 0, 0);
  const [px, py] = fromSheet(turned, u2, v2);
  assert.ok(Math.abs(px - 12) < 1e-6 && Math.abs(py - 4) < 1e-6);
});

test('EM3-3D: the sheet turns and tilts on the classic keys, and hands the window a view that keeps its middle', () => {
  const s = createAutomapSheet({ solid: true, record: () => rec(['a', 'b']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [4, 0, 3], yaw: 0 }) });
  assert.equal(s.solid, true);
  const limits = { mapW: s.size().width, mapH: s.size().height, paperW: 600, paperH: 400 };
  const view = s.homeView(limits);
  assert.equal(s.reframe(view, limits), null, 'the first ask only notes the orbit');
  assert.equal(s.key('KeyE'), true);
  s.tick(1);
  assert.ok(Math.abs(s.orbit.yaw - (ORBIT.yawRest + ORBIT.yawStep)) < 1e-3);
  assert.ok(s.reframe(view, limits), 'a turn moves the view');
  assert.equal(s.key('KeyP'), true);
  assert.equal(s.orbit.goalPitch, ORBIT.pitchMax, 'P lays it flat');
  assert.ok(Math.abs(Math.sin(s.orbit.goalYaw)) < 1e-9 && Math.cos(s.orbit.goalYaw) > 0, '...north up');
  assert.equal(s.key('KeyV'), false, 'V is the travel map\'s key - the window closes on it, the sheet never takes it');
  assert.equal(s.hint(), '', 'the solid sheet puts no key tips on the foot - its buttons are on the paper');
  const flat = createAutomapSheet({ record: () => rec(['a']), model: () => ({ rows: LEVEL }) });
  assert.equal(flat.solid, false, 'without the switch the sheet is the flat plan it was');
  assert.equal(flat.key('KeyQ'), false);
  assert.equal(flat.reframe({ ox: 0, oy: 0, scale: 1 }, limits), null);
});

test('EM3-3D: the orbit eases the short way round', () => {
  const o = { yaw: 3, pitch: 1, goalYaw: -3, goalPitch: 1 };
  easeOrbit(o, 0.05);
  assert.ok(o.yaw > 3, 'across the seam, not back through zero');
});

test('EM3-3D fix: the floor is what can be walked to - a wall top or a beam over the floor is not stood up as a tower', () => {
  // a room at 0, and over part of it a slab 3.5 up (a beam's top), assigned to the same storey
  const rows = [row('floor', 0, 0, 0, 10, 10), row('beam', 3.5, 4, 0, 5, 10)];
  const floors = deriveFloors(floorTriangles(rows));
  const field = levelField(rows, floors, { bounds: planBounds(floorTriangles(rows), 1) });
  const m = buildSolid(field, floors.map((f) => f.index), { revealed: new Uint8Array([1, 1]), storeyY: floors.map((f) => f.y) });
  const floorTops = [...m.flat.map((f) => f.top), ...m.cols.filter((c) => c.k === 1).map((c) => c.top)];
  assert.ok(floorTops.length > 0 && floorTops.every((t) => Math.abs(t) < 1e-4), 'every floor cell is at the floor, not on the beam');
});

test('EM3-3D fix: with a walked trail, only floor in sight of it is drawn; the rest is a way on', () => {
  const rows = [row('long', 0, 0, 0, 60, 4)];
  const floors = deriveFloors(floorTriangles(rows));
  const field = levelField(rows, floors, { bounds: planBounds(floorTriangles(rows), 1) });
  const all = buildSolid(field, [0], { revealed: new Uint8Array([1]), storeyY: floors.map((f) => f.y) });
  const near = buildSolid(field, [0], { revealed: new Uint8Array([1]), storeyY: floors.map((f) => f.y), trail: [[1.5, 0, 2.5]] });
  assert.ok(near.flat.length < all.flat.length / 2, `the trail draws less (${near.flat.length} of ${all.flat.length})`);
  assert.ok(near.flat.every((f) => f.x <= SOLID.sight + 2), 'and only in sight of where the player stood');
  assert.ok(near.slabs.some((s) => s.open), 'the far end is left open, not walled');
});

test('EM3-3D fix: the trail is kept on the record and is never marked partial by the scan that runs before it', async () => {
  const { automapTrailTick, automapTrailPoints, enterDungeonAutomap, revealAllAutomap, hideAllAutomap } = await import('../src/systems/automap.js');
  const fresh = { revealed: new Set() };
  assert.equal(automapTrailTick(fresh, [3.2, 1.7, 7.9]), true);
  assert.equal(automapTrailTick(fresh, [3.4, 1.7, 7.1]), false, 'one cell is one point');
  assert.deepEqual(automapTrailPoints(fresh), [[3.5, 0, 7.5]]);
  // the first cut marked this "partial" - and the reveal scan, a line above the tick, has ALWAYS just revealed
  // something, so every dungeon fell back to drawing whole models
  const scanned = { revealed: new Set(['a']) };
  automapTrailTick(scanned, [0, 1.7, 0]);
  assert.equal(scanned.trailPartial, undefined);
  assert.equal(scanned.trail.size, 1);
  const rec2 = enterDungeonAutomap('em3-fix-probe', 0);
  assert.ok(rec2.trail instanceof Set && rec2.trail.size === 0, 'a new dungeon starts with an empty trail');
  revealAllAutomap(rec2, { rows: [] });
  assert.equal(rec2.trailAll, true, 'RevealAll asks the sheet for the reveal');
  hideAllAutomap(rec2);
  assert.equal(rec2.trailAll, undefined);
});

// a five-storey level of big models, as Daggerfall's are: one glance reveals every storey's model whole
function tower() {
  const rows = [];
  for (let f = 0; f < 5; f++) {
    rows.push(row(`hall${f}`, f * 9, 0, 0, 30, 10), row(`side${f}`, f * 9, 30, 0, 60, 10));
  }
  const r = rec(rows.map((q) => q.key));
  r.trail = new Set();
  return { rows, r };
}
const walkOn = (r, y, x0, x1, z) => { for (let x = x0; x <= x1; x++) r.trail.add(`${x},${y},${z}`); };

const PROXY = (fills = null) => new Proxy({}, { get: (_, k) => (k === 'measureText' ? (t) => ({ width: t.length * 8 }) : k === 'fill' && fills ? () => fills.push(1) : () => {}), set: () => true });
const paintOnce = (s, ctx) => {
  const limits = { mapW: s.size().width, mapH: s.size().height, paperW: 1100, paperH: 680 };
  s.paintStatic(ctx, { model: s.ensure(), view: s.homeView(limits), paperW: 1100, paperH: 680, dpr: 1 });
  return limits;
};

test('EM3-3D fix: the solid map is the whole dungeon at once - no floor list (its floor keys page the slice)', () => {
  const { rows, r } = tower();
  walkOn(r, 0, 2, 8, 5); walkOn(r, 18, 2, 8, 5);
  const s = createAutomapSheet({ solid: true, record: () => r, model: () => ({ rows }), player: () => ({ feet: [5, 18, 5], yaw: 0 }) });
  paintOnce(s, PROXY());
  assert.equal(s.strip, null, 'the classic 3D map has no Floor 1, 2, 3 in the corner, and neither does this');
  assert.equal(s.floor, 2, 'it stays on the player\'s floor');
});

test('EM3-3D fix: every floor the player has been on is drawn at its own height, the others not at all', () => {
  const draw = (walkFloor1) => {
    const { rows, r } = tower();
    walkOn(r, 18, 2, 8, 5);
    if (walkFloor1) walkOn(r, 0, 2, 8, 5);
    const s = createAutomapSheet({ solid: true, record: () => r, model: () => ({ rows }), player: () => ({ feet: [5, 18, 5], yaw: 0 }) });
    const fills = [];
    paintOnce(s, PROXY(fills));
    return fills.length;
  };
  const one = draw(false), two = draw(true);
  assert.ok(one > 0);
  assert.ok(two > one, `Floor 1, walked, is on the map with Floor 3 (${two} > ${one})`);
  // and the three floors seen from the stairs but never walked add nothing: the same as a level without them
  const { rows, r } = tower();
  walkOn(r, 18, 2, 8, 5);
  const only3 = rows.filter((q) => q.key.endsWith('2'));
  const s3 = createAutomapSheet({ solid: true, record: () => r, model: () => ({ rows: only3 }), player: () => ({ feet: [5, 18, 5], yaw: 0 }) });
  const fills = [];
  paintOnce(s3, PROXY(fills));
  assert.equal(one, fills.length);
});

test('EM3-3D fix: on the flat plan the strip lists only walked floors, and a press anywhere on a row is a control', () => {
  const { rows, r } = tower();
  walkOn(r, 0, 2, 8, 5); walkOn(r, 18, 2, 8, 5);
  const s = createAutomapSheet({ record: () => r, model: () => ({ rows }), player: () => ({ feet: [5, 18, 5], yaw: 0 }) });
  paintOnce(s, PROXY());
  assert.deepEqual(s.strip.rows.map((q) => q.label), ['Floor 3', 'Floor 1']);
  assert.equal(s.key('PageDown'), true);
  assert.equal(s.floor, 0, 'PgDn skips the floor never walked');
  paintOnce(s, PROXY());
  const row3 = s.strip.rows.find((q) => q.label === 'Floor 3');
  for (const dx of [-20, 0, row3.w / 2, row3.w + 20]) assert.equal(s.control(row3.x + dx, row3.y + row3.h / 2), true, `the row's band at ${dx}`);
  assert.equal(s.control(200, 400), false, 'the map itself is not a control');
  s.pickAt(row3.x + row3.w + 20, row3.y + 2);
  assert.equal(s.floor, 2);
});

test('EM3-3D fix: a room is seen wall to wall from inside it, and nothing is seen through rock', () => {
  // a 30 x 16 hall (wider than the old 10 m walk), a solid wall at x 30..33, and a second room beyond it
  const rows = [row('hall', 0, 0, 0, 30, 16), row('beyond', 0, 33, 0, 45, 16)];
  const floors = deriveFloors(floorTriangles(rows));
  const field = levelField(rows, floors, { bounds: planBounds(floorTriangles(rows), 1) });
  const m = buildSolid(field, [0], { revealed: new Uint8Array([1, 1]), storeyY: floors.map((f) => f.y), trail: [[15.5, 0, 8.5]] });
  const floorCells = [...m.flat, ...m.cols.filter((c) => c.k === 1)];
  const ox = Math.min(...floorCells.map((f) => f.x));   // the grid's west edge (planBounds' margin)
  assert.equal(floorCells.filter((f) => f.x < ox + 30).length, 30 * 16, 'the whole hall, corner to corner');
  assert.equal(floorCells.filter((f) => f.x >= ox + 33).length, 0, 'not the room behind the wall');
  assert.ok(m.cols.some((c) => c.k === 2 && c.x === ox + 30), 'and the hall\'s far wall is drawn');
});

test('EM3-3D fix: a gap the raster leaves in a floor is floor, not a tower', () => {
  // a 12x12 room, and in it holes no triangle's centre-sample covered: a lone cell, a pair, an L of three
  const rows = [];
  const hole = new Set(['5,5', '8,3', '9,3', '3,8', '3,9', '4,9']);
  for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) if (!hole.has(`${x},${z}`)) rows.push(row(`c${x},${z}`, 0, x, z, x + 1, z + 1));
  const floors = deriveFloors(floorTriangles(rows));
  const field = levelField(rows, floors, { bounds: planBounds(floorTriangles(rows), 1) });
  const m = buildSolid(field, [0], { revealed: new Uint8Array(rows.length).fill(1), storeyY: floors.map((f) => f.y) });
  assert.equal(m.cols.filter((c) => c.k === 2 && c.x > 0.5 && c.x < 10.5 && c.y > 0.5 && c.y < 10.5).length, 0, 'no wall inside the room');
  assert.equal(m.flat.length + m.cols.filter((c) => c.k === 1).length, 144, 'every cell of the room is floor');
});

test('EM3-3D fix: THE CUTAWAY - a wall between the eye and the floor behind it is cut to a kerb, the far wall stands', () => {
  const rows = [row('room', 0, 0, 0, 10, 10)];
  const floors = deriveFloors(floorTriangles(rows));
  const field = levelField(rows, floors, { bounds: planBounds(floorTriangles(rows), 1) });
  const opts = { revealed: new Uint8Array([1]), storeyY: floors.map((f) => f.y), planX0: 0, planY0: 0 };
  // yaw 0: depth grows toward plan SOUTH (makeCamera), so the eye is south of the room
  const m = buildSolid(field, [0], { ...opts, cutYaw: 0 });
  const walls = m.cols.filter((c) => c.k === 2);
  const midX = (c) => c.x > 2 && c.x < 7;
  const north = walls.filter((c) => midX(c) && c.y < 0.5), south = walls.filter((c) => midX(c) && c.y > 9.5);
  assert.ok(north.length && south.length);
  assert.ok(north.every((c) => Math.abs(c.top - SOLID.wallRise) < 1e-4), 'the far wall faces the eye and stands whole');
  assert.ok(south.every((c) => Math.abs(c.top - SOLID.cutRise) < 1e-4), 'the near wall is cut, so the room lies open');
  // turned half way round, the other wall is the near one
  const back = buildSolid(field, [0], { ...opts, cutYaw: Math.PI }).cols.filter((c) => c.k === 2 && midX(c));
  assert.ok(back.filter((c) => c.y < 0.5).every((c) => Math.abs(c.top - SOLID.cutRise) < 1e-4));
  assert.ok(back.filter((c) => c.y > 9.5).every((c) => Math.abs(c.top - SOLID.wallRise) < 1e-4));
  // without a turn to cut for, every wall stands, as before
  assert.ok(buildSolid(field, [0], opts).cols.filter((c) => c.k === 2).every((c) => Math.abs(c.top - SOLID.wallRise) < 1e-4));
});

test('EM3-3D fix: walls are thin strips against their floor, and rock touching no floor is not drawn', () => {
  const rows = [row('room', 0, 0, 0, 10, 10)];
  const floors = deriveFloors(floorTriangles(rows));
  const field = levelField(rows, floors, { bounds: planBounds(floorTriangles(rows), 1) });
  const m = buildSolid(field, [0], { revealed: new Uint8Array([1]), storeyY: floors.map((f) => f.y) });
  const walls = m.cols.filter((c) => c.k === 2);
  assert.ok(walls.length > 0 && walls.every((c) => c.fp));
  for (const c of walls) {
    const [x0, y0, x1, y1] = c.fp;
    assert.ok(Math.min(x1 - x0, y1 - y0) <= SOLID.wallThick + 1e-6, 'no wall is a metre thick');
  }
});

test('EM3-3D fix: a flight is a ramp, and the wall beside it slopes with it', () => {
  // a corridor climbing 0 -> 2.4 over 8 cells, between two landings
  const rows = [row('low', 0, 0, 0, 4, 3), row('high', 2.4, 12, 0, 16, 3)];
  for (let k = 0; k < 8; k++) rows.push(row(`s${k}`, (k + 1) * 0.3, 4 + k, 0, 5 + k, 3));
  const floors = deriveFloors(floorTriangles(rows));
  const field = levelField(rows, floors, { bounds: planBounds(floorTriangles(rows), 1) });
  const m = buildSolid(field, floors.map((f) => f.index), { revealed: new Uint8Array(rows.length).fill(1), storeyY: floors.map((f) => f.y) });
  const ramps = m.cols.filter((c) => c.k === 1 && c.step);
  assert.ok(ramps.length >= 6, `the flight's cells are ramps (${ramps.length})`);
  const slopedWalls = m.cols.filter((c) => c.k === 2 && c.step);
  assert.ok(slopedWalls.length >= 6, `and so are the walls along it (${slopedWalls.length})`);
});

test('EM3-3D fix: a turn re-cuts the kept classification instead of rebuilding what was seen', () => {
  const rows = [row('room', 0, 0, 0, 10, 10)];
  const floors = deriveFloors(floorTriangles(rows));
  const field = levelField(rows, floors, { bounds: planBounds(floorTriangles(rows), 1) });
  const opts = { revealed: new Uint8Array([1]), storeyY: floors.map((f) => f.y) };
  const a = buildSolid(field, [0], { ...opts, cutYaw: 0 });
  const b = buildSolid(field, [0], { ...opts, cutYaw: Math.PI, classified: a.classified });
  assert.equal(b.classified, a.classified, 'the same classification, reused');
  assert.equal(b.count, a.count);
  const again = buildSolid(field, [0], { ...opts, cutYaw: 0, classified: a.classified });
  assert.deepEqual(again.cols.map((c) => c.top), a.cols.map((c) => c.top), 'and a cut never lowers the kept walls for the next one');
});

test('EM3-3D classic: a face is drawn exactly when the GAME would draw it - its wound normal at the eye', async () => {
  const { rowMesh, createDungeonInk, SLICE_ABOVE } = await import('../src/ui/inkDungeonGL.js');
  const { perspective, lookAt, mirrorProjectionX } = await import('../src/world/mat4.js');
  const { slicingPositionY, DEFAULT_SLICING_BIAS_Y } = await import('../src/systems/automap.js');
  const { EYE_HEIGHT } = await import('../src/player/motor.js');
  // the world pass's own matrices: mirrored perspective over a right-handed lookAt, culled with frontFace(CW)
  const P = mirrorProjectionX(perspective(1, 1.5, 0.1, 100)), V = lookAt([0, 10, -3], [0, 0, 0], [0, 1, 0]);
  const M = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let x = 0; for (let k = 0; k < 4; k++) x += P[k * 4 + r] * V[c * 4 + k]; M[c * 4 + r] = x; }
  const clip = (q) => { const w = M[3] * q[0] + M[7] * q[1] + M[11] * q[2] + M[15]; return [(M[0] * q[0] + M[4] * q[1] + M[8] * q[2] + M[12]) / w, (M[1] * q[0] + M[5] * q[1] + M[9] * q[2] + M[13]) / w]; };
  for (const tri of [[[0, 0, 0], [0, 0, 1], [1, 0, 0]], [[0, 0, 0], [1, 0, 0], [0, 0, 1]]]) {
    const [a, b, c] = tri.map(clip);
    const gameDraws = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]) < 0;   // CW on screen is front
    const m = rowMesh({ positions: new Float32Array(tri.flat()), indices: new Uint16Array([0, 1, 2]), matrix: null });
    const eye = [0, 10, -3];
    const inkDraws = m.nrm[0] * eye[0] + m.nrm[1] * eye[1] + m.nrm[2] * eye[2] > 0;   // the eye is up and behind
    assert.equal(inkDraws, gameDraws, `the ink culls as the game does (${JSON.stringify(tri)})`);
  }
  assert.equal(createDungeonInk(null), null, 'no WebGL2: the cell drawing, as before');
  assert.equal(SLICE_ABOVE, slicingPositionY(0, EYE_HEIGHT, DEFAULT_SLICING_BIAS_Y), 'the classic window\'s slice');
});

test('EM3-3D classic: a step\'s riser joins its flight, so a stair is never inked solid; a wall stays a wall', async () => {
  const { rowMesh, RISER_MAX } = await import('../src/ui/inkDungeonGL.js');
  const quad = (pts) => ({ positions: new Float32Array(pts.flat()), indices: new Uint16Array([0, 1, 2, 0, 2, 3]), matrix: null });
  const riser = rowMesh(quad([[0, 0, 0], [1, 0, 0], [1, 0.25, 0], [0, 0.25, 0]]));
  const wall = rowMesh(quad([[0, 0, 0], [1, 0, 0], [1, 3, 0], [0, 3, 0]]));
  assert.ok(0.25 <= RISER_MAX && RISER_MAX < 1);
  assert.equal(riser.nrm[3], 2, 'a quarter-metre upright face is a riser');
  assert.equal(wall.nrm[3], 1, 'a wall is a wall');
});

test('FIELD BUGS 2026-10-05c RAMP-INK ("where there is a steep upward incline in a hallway, never gets filled properly"): a ramp the player walks is inked as floor - 55 and 65 degrees, Daggerfall\'s steep hallways - by the plan\'s own law (automapFloors FLOOR_NY, the motor\'s slope limit), and a face steeper than the motor walks stays a wall; the shader reads the one constant, no literal (mutants: the old 0.6, the law not the plan\'s)', async () => {
  const { rowMesh, FLOOR_FACE_NY, faceInkOf } = await import('../src/ui/inkDungeonGL.js');
  const { FLOOR_NY } = await import('../src/systems/automapFloors.js');
  assert.equal(FLOOR_FACE_NY, FLOOR_NY, 'one law for the plan and the 3D sheet');
  // a hallway's climb along +z, wound so its face looks up (as the world pass culls it)
  const ramp = (deg) => {
    const h = Math.tan((deg * Math.PI) / 180);
    return rowMesh({ positions: new Float32Array([0, 0, 0, 0, h, 1, 1, h, 1, 1, 0, 0]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]), matrix: null });
  };
  for (const deg of [30, 53, 55, 65]) {
    const m = ramp(deg);
    assert.ok(Math.abs(m.nrm[1] - Math.cos((deg * Math.PI) / 180)) < 1e-6, `${deg} degrees looks up`);
    assert.equal(faceInkOf(m.nrm[1]), 'floor', `a ${deg} degree ramp is ground walked`);
  }
  assert.equal(faceInkOf(ramp(75).nrm[1]), 'wall', 'steeper than the motor walks: a wall');
  assert.equal(faceInkOf(-1), 'ceiling');
  const src = readFileSync(new URL('../src/ui/inkDungeonGL.js', import.meta.url), 'utf8');
  assert.equal((src.match(/n\.y > \$\{FNY\}/g) ?? []).length, 4, 'the climb, the stones, the pencil, the wet floor: the one constant');
  assert.doesNotMatch(src, /n\.y > 0\.6/, 'no literal floor lean left in the shader');
});

test('EM3-3D: the floor buttons and PgUp/PgDn page the slice through every storey, and home brings it back', () => {
  const { rows, r } = tower();
  walkOn(r, 0, 2, 8, 5);
  const s = createAutomapSheet({ solid: true, record: () => r, model: () => ({ rows }), player: () => ({ feet: [5, 18, 5], yaw: 0 }) });
  paintOnce(s, PROXY());
  assert.equal(s.viewStorey, 2, 'it starts on the player\'s storey');
  assert.equal(s.key('PageUp'), true);
  assert.equal(s.viewStorey, 3);
  assert.equal(s.key('PageDown'), true); s.key('PageDown');
  assert.equal(s.viewStorey, 1);
  for (let i = 0; i < 5; i++) s.key('PageDown');
  assert.equal(s.viewStorey, 0, 'and stops at the bottom');
  s.key('Home');
  assert.equal(s.viewStorey, 2, 'home is the player\'s floor again');
  assert.ok(ORBIT_BUTTONS.some((b) => b.id === 'floorUp') && ORBIT_BUTTONS.some((b) => b.id === 'floorDown'), 'with buttons on the paper');
});

test('EM3-3D: the right stick zooms the held map - forward in, back out', async () => {
  const { HeldMapWindow, PAD_DEADZONE } = await import('../src/ui/heldMap.js');
  const zoomed = [];
  const fake = { _phase: 'map', _paper: { w: 800, h: 600 }, _sheet: null, _zoomBy: (f) => zoomed.push(f) };
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, -1] };
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad] }, configurable: true });
  try {
    HeldMapWindow.prototype._padTick.call(fake, 0.1);
    pad.axes[3] = 1; HeldMapWindow.prototype._padTick.call(fake, 0.1);
    pad.axes[3] = PAD_DEADZONE * 0.5; HeldMapWindow.prototype._padTick.call(fake, 0.1);
  } finally {
    if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator;
  }
  assert.equal(zoomed.length, 2, 'a stick at rest does nothing');
  assert.ok(zoomed[0] > 1 && zoomed[1] < 1, 'forward is in, back is out');
});

test('EM3-3D: the 3D map tilts from straight down all the way to level, and water carries its level to the ink', async () => {
  assert.equal(ORBIT.pitchMax, Math.PI / 2, 'straight down');
  assert.ok(ORBIT.pitchMin > 0.1 && ORBIT.pitchMin < 0.35, 'down to nearly side-on - never level, never under the floor');
  const { rowMesh, WAVE_STEP, WAVE_SHARE } = await import('../src/ui/inkDungeonGL.js');
  const floor = { positions: new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0]), indices: new Uint16Array([0, 1, 2]), matrix: null };
  assert.ok(rowMesh({ ...floor, waterLevel: 0.6 }).water.every((w) => Math.abs(w - 0.6) < 1e-6), 'a watered block\'s level rides every vertex');
  assert.ok(rowMesh({ ...floor }).water.every((w) => w < -1e8), 'a dry one is never under water');
  assert.ok(WAVE_STEP > 0.5 && WAVE_SHARE > 0 && WAVE_SHARE < 1, 'the waves are a scatter, not a pattern');
});

test('TURN-FIXED: a held turn and a tilt all the way down to level keep the middle of the EXPLORED map still on the paper, frame by frame', () => {
  const { rows, r } = tower();
  walkOn(r, 18, 2, 8, 5);
  const s = createAutomapSheet({ solid: true, record: () => r, model: () => ({ rows }), player: () => ({ feet: [5, 18, 5], yaw: 0 }) });
  const limits = paintOnce(s, PROXY());
  let view = s.homeView(limits);
  const repaint = () => s.paintStatic(PROXY(), { model: s.ensure(), view, paperW: 1100, paperH: 680, dpr: 1 });
  repaint();
  s.reframe(view, limits);   // the window's first look
  let worst = 0, piv = null, first = null;
  s.orbitHold(true);
  const steps = [...Array(20)].map(() => [15, 0]).concat([...Array(30)].map(() => [0, 12]), [...Array(30)].map(() => [0, -12]));
  for (const [dx, dy] of steps) {
    s.orbitBy(dx, dy);
    for (let k = 0; k < 3; k++) { s.tick(1 / 60); const v = s.reframe(view, limits); if (v) view = v; }
    repaint();
    piv ??= s.pivot;
    assert.ok(piv, 'a turn has a pivot');
    const at = s.paperAt(piv.px, piv.py, piv.y);
    first ??= at;
    worst = Math.max(worst, Math.hypot(at[0] - first[0], at[1] - first[1]));
  }
  s.orbitHold(false);
  assert.ok(worst < 0.01, `the explored middle stays put (${worst.toFixed(3)} px off at worst)`);
});

// ME-PAN fix: the pan clamp keeps a sheet's drawn box on the paper, but always lets the player be centred.
test('ME-PAN: clampView with a pan box holds the drawn map on the paper and allows the view centred on the player', async () => {
  const { clampView, PAN_SLACK } = await import('../src/ui/inkMap.js');
  const L = { mapW: 5000, mapH: 5000, paperW: 800, paperH: 600, pan: { x0: 1000, y0: 1000, x1: 1400, y1: 1300, me: [1395, 1010] } };
  const far = clampView({ ox: 0, oy: 0, scale: 4 }, L);          // dragged way off to the top left
  assert.ok(far.ox >= 1000 - 200 * PAN_SLACK - 1e-9 && far.oy >= Math.min(1000 - 150 * PAN_SLACK, 1010 - 75) - 1e-9);
  const off = clampView({ ox: 4000, oy: 4000, scale: 4 }, L);    // and way off to the bottom right
  assert.ok(off.ox <= Math.max(1400 - 200 + 200 * PAN_SLACK, 1395 - 100) + 1e-9);
  const me = { ox: 1395 - 100, oy: 1010 - 75, scale: 4 };        // the player at the paper's middle
  assert.deepEqual(clampView(me, L), me);
});

test('ME-PAN: Home puts the player in the middle of the paper, not the middle of the walked dungeon', () => {
  const s = createAutomapSheet({ solid: true, record: () => rec(['a', 'b']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [15, 0, 3], yaw: 0 }) });
  const size = s.size();
  const limits = { mapW: size.width, mapH: size.height, paperW: 600, paperH: 400 };
  s.reframe(s.homeView(limits), limits);
  assert.equal(s.key('Home'), 'home');
  const v = s.reframe(s.homeView(limits), limits);   // the window's next tick answers the Home ask
  assert.ok(v, 'Home hands the window a view');
  assert.deepEqual(s.meView(limits), v, 'and it is the view centred on the player');
  assert.notDeepEqual(s.homeView(limits), v, 'not the rest view of the whole walked dungeon');
  // the player's own plan point lands at the paper's middle
  const box = s.panBox();
  assert.ok(box.me, 'the pan box carries the player');
  assert.ok(Math.abs((box.me[0] - v.ox) * v.scale - 300) < 1e-6 && Math.abs((box.me[1] - v.oy) * v.scale - 200) < 1e-6);
});

test('ME-PAN: the border stops a drag outward but never snaps a view back', async () => {
  const { clampView } = await import('../src/ui/inkMap.js');
  const L = { mapW: 5000, mapH: 5000, paperW: 800, paperH: 600, pan: { x0: 1000, y0: 1000, x1: 1400, y1: 1300 } };
  // a turn left the middle 300 units west of the drawn box: a drag further west is stopped where it was...
  const was = { ox: 700 - 100, oy: 1100 - 75, scale: 4 };
  const further = clampView({ ...was, ox: was.ox - 50 }, { ...L, prev: was });
  assert.ok(Math.abs(further.ox - was.ox) < 1e-9, 'no further out');
  // ...a drag back east is taken as it is, and staying put is not pulled back
  const back = clampView({ ...was, ox: was.ox + 30 }, { ...L, prev: was });
  assert.ok(Math.abs(back.ox - (was.ox + 30)) < 1e-9, 'coming back in is free');
  assert.deepEqual(clampView(was, { ...L, prev: was }), was, 'no snap');
});

test('TURN-FIXED: a right-drag turns about the middle of what is explored, wherever it began and wherever the view was left; Me turns about you until a drag', () => {
  const s = createAutomapSheet({ solid: true, record: () => rec(['a', 'b']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [4, 0, 3], yaw: 0 }) });
  const size = s.size();
  const limits = { mapW: size.width, mapH: size.height, paperW: 600, paperH: 400 };
  let view = s.homeView(limits);
  s.reframe(view, limits);
  const turnOnce = () => {
    s.orbitHold(true); s.orbitBy(300, 0);
    let p = null;
    for (let i = 0; i < 60; i++) { s.tick(1 / 30); const t = s.reframe(view, limits); if (t) view = t; p ??= s.pivot; }
    s.orbitHold(false);
    for (let i = 0; i < 5; i++) { s.tick(1 / 30); const t = s.reframe(view, limits); if (t) view = t; }
    return p;
  };
  s.orbitFrom(5, 5);   // the paper's corner
  const a = turnOnce();
  view = { ...view, ox: view.ox + 40, oy: view.oy - 25 }; s.viewMoved();   // a left-drag elsewhere
  const b = turnOnce();
  assert.ok(a && b && Math.hypot(a.px - b.px, a.py - b.py) < 1e-6 && Math.abs(a.y - b.y) < 1e-6, 'the same fixed pivot both times');
});

test('TP-SEEN: a teleporter shows once its spot is seen, and where it leads stays unknown until walked', async () => {
  const { teleporterConnection, recordTeleporterConnection } = await import('../src/systems/automap.js');
  const c = teleporterConnection({ pos: [3, 0, 3], yawDeg: 0 }, { pos: [12, 0, 3], yawDeg: 90 });
  const portals = new Map([[c.key, c.conn]]);
  const r = rec(['b']);   // only the corridor seen, not the room the portal stands in
  const s = createAutomapSheet({ solid: false, record: () => r, model: () => ({ rows: LEVEL }), player: () => ({ feet: [12, 0, 3], yaw: 0 }), portals: () => portals });
  const size = s.size();
  const view = { ox: 0, oy: 0, scale: 20 };
  const paint = () => { s.paintStatic({}, { view, paperW: 600, paperH: 400, dpr: 1 }); s.paintOverlay({}, { view, paperW: 600, paperH: 400, dpr: 1 }); };
  paint();
  const labels = () => { const out = []; for (let x = 0; x < 600; x += 4) for (let y = 0; y < 400; y += 4) { const l = s.hoverLabel(x, y).label; if (l === 'Teleporter') out.push([x, y]); } return out; };
  assert.equal(labels().length, 0, 'unseen: not on the map');
  r.revealed.add('a');
  paint();
  assert.ok(labels().length > 0, 'seen: on the map, as a teleporter');
  recordTeleporterConnection(r, { pos: [3, 0, 3], yawDeg: 0 }, { pos: [12, 0, 3], yawDeg: 90 });
  paint();
  assert.equal(labels().length, 0, 'walked: the recorded one takes its place (no second mark)');
  void size;
});

test('ALL-FLOORS: L (or the All button) shows every explored floor, Me keeps it, and paging a floor leaves it', () => {
  const s = createAutomapSheet({ solid: true, record: () => rec(['a', 'b']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [4, 0, 3], yaw: 0 }) });
  assert.equal(s.allFloors, false);
  assert.equal(s.key('KeyL'), true);
  assert.equal(s.allFloors, true);
  assert.equal(s.key('Home'), 'home');
  assert.equal(s.allFloors, true, 'Me centres on you and keeps every floor');
  s.press('allFloors');
  assert.equal(s.allFloors, false, 'the button toggles it back');
});

test('ALL-FLOORS: a row belongs to the storey of its FLOOR, not of the rock under it', async () => {
  const { rowMesh } = await import('../src/ui/inkDungeonGL.js');
  // a room's floor at 5 m over a block of rock whose underside is at 2 m (both level faces; the floor is the bigger)
  const q = (y, s, up) => { const a = [0, y, 0], b = [s, y, 0], c = [s, y, s], d = [0, y, s]; return up ? [a, d, c, a, c, b] : [a, b, c, a, c, d]; };
  const tris = [...q(5, 10, true), ...q(2, 4, false)];
  const positions = new Float32Array(tris.flat());
  const indices = new Uint16Array(tris.map((_, i) => i));
  const m = rowMesh({ positions, indices, matrix: null });
  assert.ok(m.rowY.every((y) => Math.abs(y - 5) < 1e-6), `the floor's storey (${m.rowY[0]})`);
});

test('ME-PIVOT: after Me a turn goes about the player; after a pan it goes about the middle, never the player', () => {
  const mk = () => createAutomapSheet({ solid: true, record: () => rec(['a', 'b']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [14, 0, 3], yaw: 0 }) });
  const size = mk().size();
  const limits = { mapW: size.width, mapH: size.height, paperW: 600, paperH: 400 };
  const turnAndRead = (s, view) => {
    s.orbitHold(true); s.orbitBy(200, 0);
    let pv = null;
    for (let i = 0; i < 40; i++) { s.tick(1 / 30); const t = s.reframe(view, limits); if (t) view = t; pv = s.pivot ?? pv; }
    s.orbitHold(false);
    return pv;
  };
  // Me pressed, nothing moved since: the pivot is the player
  const s1 = mk();
  let v = s1.homeView(limits); s1.reframe(v, limits);
  s1.key('Home'); v = s1.reframe(v, limits) ?? v;
  assert.equal(s1.meLocked, true);
  const p1 = turnAndRead(s1, v);
  assert.ok(p1 && Math.abs(p1.px - s1.planOf(14, 3)[0]) < 1e-6, 'about you after Me');
  // moved since: the pivot is NOT the player
  const s2 = mk();
  let w = s2.homeView(limits); s2.reframe(w, limits);
  s2.key('Home'); w = s2.reframe(w, limits) ?? w;
  s2.viewMoved();
  w = { ...w, ox: w.ox - 3 };
  const p2 = turnAndRead(s2, w);
  const me = s2.planOf(14, 3);
  assert.ok(p2 && Math.hypot(p2.px - me[0], p2.py - me[1]) > 0.5, 'not about you once the map was moved');
});
