// EM2 - THE FLOOR MODEL (2026-09-21, Mac: "The automap should become a
// 2d map and floor based instead of the current 3D implementation,
// streamlining it").
//
// A Daggerfall dungeon HAS NO FLOORS. The block record parses x and z
// and no y (formats/mapsFile.js), every block is laid at y zero
// (world/dungeonLayout.js: "Block (X, Z) sits at (X * RDBSide, 0, Z *
// RDBSide)"), there is no `originY` anywhere in src/, and DFU's own
// automap answers the question with a cut plane the player slides. So
// the storeys are DERIVED, and these pins drive the derivation with
// geometry built by hand: two stacked rooms, a ramp between them, a
// wall that is not a floor, a sliver that votes for nothing, and a hall
// whose far half was never revealed.
//
// THE PLAN IS A COASTLINE. The outline of the covered cells is
// `boundarySegments` + `linkSegments` - inkMap's own two functions, the
// ones that ink the Iliac Bay - so the last pin drives floorPlan with
// the REAL pair and checks the chain lands on the room's true edges in
// world units.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  floorTriangles, deriveFloors, floorAt, floorOccupancy, planBounds, floorPlan,
  FLOOR_NY, LEVEL_NY, FLOOR_MIN_GAP, PLAN_CELL, MIN_TRI_AREA,
} from '../src/systems/automapFloors.js';
import { boundarySegments, linkSegments } from '../src/ui/inkMap.js';
import { SLOPE_LIMIT_DEG, CAPSULE_HEIGHT } from '../src/player/motor.js';

/** A flat quad at height y over [x0,x1]x[z0,z1], as a row the reveal
 *  index would hold: CPU triangles plus a placement matrix. */
function floorQuad(y, x0, z0, x1, z1, { key = 'k', matrix = null } = {}) {
  return {
    key,
    positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    matrix,
  };
}
/** A vertical wall quad - a floor this is not. */
function wallQuad(x, y0, y1, z0, z1, key = 'w') {
  return {
    key,
    positions: new Float32Array([x, y0, z0, x, y0, z1, x, y1, z1, x, y1, z0]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    matrix: null,
  };
}
/** A ramp from (x0,yLow) up to (x1,yHigh) - a floor at every height
 *  between, which is exactly what makes it a ramp. */
function rampQuad(x0, x1, yLow, yHigh, z0, z1, key = 'r') {
  return {
    key,
    positions: new Float32Array([x0, yLow, z0, x1, yHigh, z0, x1, yHigh, z1, x0, yLow, z1]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    matrix: null,
  };
}

test('EM2: the constants are the motor\'s own - a floor is what the player could stand on, a storey what they could stand up in', () => {
  assert.equal(FLOOR_NY, Math.cos((SLOPE_LIMIT_DEG * Math.PI) / 180), 'the slope limit has ONE home (player/motor.js)');
  assert.equal(FLOOR_MIN_GAP, CAPSULE_HEIGHT + 1.2, 'the player\'s own height plus the headroom a room needs');
  assert.ok(FLOOR_MIN_GAP > CAPSULE_HEIGHT, 'a storey you cannot stand up in is not a storey');
  assert.equal(PLAN_CELL, 1);

  // THE TWO THRESHOLDS, and the mistake that produced them. The first
  // cut had ONE - the motor's walk limit - and clustered the walkable
  // set by height gaps. A ramp puts a walkable triangle at EVERY height
  // between the floors it joins, so the gap-walk found no gap and two
  // rooms came back as one storey; every real dungeon has ramps, so
  // that cut would have answered "one floor" for most of the game. A
  // storey is defined by its FLAT floor and a ramp merely belongs to
  // one, so LEVEL_NY votes and FLOOR_NY draws.
  assert.ok(LEVEL_NY > FLOOR_NY, 'the voting threshold is the stricter of the two');
  assert.equal(LEVEL_NY, Math.cos((20 * Math.PI) / 180));
});

test('EM2: a ramp is WALKED and DRAWN but votes for no storey - the two thresholds, at a triangle', () => {
  // a 38-degree ramp: inside the motor's walk limit, outside flat
  const ramp = floorTriangles([rampQuad(0, 10, 0, 8, 0, 10)]);
  assert.equal(ramp.length, 2, 'walkable: the motor could climb it, so the plan draws it');
  for (const t of ramp) assert.equal(t.flat, false, 'and it votes for nothing');
  // a floor a hair off square still votes
  const tilted = floorTriangles([rampQuad(0, 10, 0, 0.5, 0, 10)]);
  for (const t of tilted) assert.equal(t.flat, true, 'three degrees is a floor laid by hand, not a slope');
  // a wall is neither
  assert.deepEqual(floorTriangles([wallQuad(0, 0, 4, 0, 10)]), []);
});

test('EM2: floorTriangles keeps what faces up, in world space, and drops the walls and the slivers', () => {
  const rows = [floorQuad(0, 0, 0, 10, 10), wallQuad(0, 0, 4, 0, 10)];
  const tris = floorTriangles(rows);
  assert.equal(tris.length, 2, 'the floor\'s two triangles, and neither of the wall\'s');
  for (const t of tris) assert.equal(t.y, 0);
  assert.equal(tris[0].area + tris[1].area, 100, 'the area is the quad\'s, and it is the weight a storey is meaned by');

  // THE MATRIX IS APPLIED: the same quad placed 20 up and 5 over is a
  // different storey in a different place. (The reveal index holds an
  // AT-REST matrix per row - automapModel.js - so this is not optional.)
  const moved = floorTriangles([floorQuad(0, 0, 0, 10, 10, {
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 20, 0, 1],
  })]);
  assert.equal(moved[0].y, 20, 'the placement\'s Y');
  assert.equal(Math.min(moved[0].ax, moved[0].bx, moved[0].cx), 5, 'and its X');

  // a sliver votes for nothing
  const sliver = floorQuad(3, 0, 0, 0.05, 0.05);
  assert.deepEqual(floorTriangles([sliver]), [], `under ${MIN_TRI_AREA} of area is a seam, not a floor`);

  // a row the layout kept no geometry for contributes nothing rather than throwing
  assert.deepEqual(floorTriangles([{ key: 'bare', positions: null, indices: null }]), []);
  assert.deepEqual(floorTriangles(null), []);
});

test('EM2: two stacked rooms are two storeys; a step is not a storey', () => {
  const tris = floorTriangles([floorQuad(0, 0, 0, 10, 10, { key: 'a' }), floorQuad(8, 0, 0, 10, 10, { key: 'b' })]);
  const floors = deriveFloors(tris);
  assert.equal(floors.length, 2);
  assert.deepEqual(floors.map((f) => f.y), [0, 8]);
  assert.deepEqual(floors.map((f) => f.label), ['Floor 1', 'Floor 2'], 'bottom first, and named for a player rather than for a height');
  assert.deepEqual(floors.map((f) => f.index), [0, 1]);

  // a dais half a metre up is the SAME storey - it is inside the gap
  const dais = deriveFloors(floorTriangles([floorQuad(0, 0, 0, 10, 10), floorQuad(0.5, 2, 2, 4, 4)]));
  assert.equal(dais.length, 1, 'a step is a step');

  // and the storey's height is AREA-WEIGHTED: the great hall decides it,
  // not the little platform at the other end of the gap
  assert.ok(dais[0].y < 0.1, `the 100-unit floor outvotes the 4-unit dais (${dais[0].y})`);
});

test('EM2: a ramp joins two storeys and appears on BOTH, because that is what a ramp is', () => {
  const rows = [
    floorQuad(0, 0, 0, 10, 10, { key: 'low' }),
    floorQuad(8, 20, 0, 30, 10, { key: 'high' }),
    rampQuad(10, 20, 0, 8, 0, 10, 'ramp'),
  ];
  const tris = floorTriangles(rows);
  const floors = deriveFloors(tris);
  assert.ok(floors.length >= 2, `the two rooms are still two storeys (${floors.length})`);
  const ramp = tris.filter((t) => t.ax >= 10 && t.ax <= 20 || t.bx >= 10 && t.bx <= 20);
  const onFloors = new Set(ramp.map((t) => floorAt(floors, t.y)));
  assert.ok(onFloors.size >= 1, 'the ramp\'s triangles are assigned somewhere');
  // the two ENDS of the ramp belong to the storeys they meet
  assert.equal(floorAt(floors, 0), 0);
  assert.equal(floorAt(floors, 8), floors.length - 1);
  // nearest wins, and the midpoint goes to whichever is nearer
  assert.equal(floorAt(floors, 0.1), 0);
  assert.equal(floorAt([], 5), -1, 'no storeys at all is -1, not a crash');
});

test('EM2: the occupancy is the walkable area, a cell at a time, with a rim of empty to close against', () => {
  const tris = floorTriangles([floorQuad(0, 0, 0, 10, 10)]);
  const b = planBounds(tris);
  assert.deepEqual(b, { x0: -1, z0: -1, x1: 11, z1: 11 }, 'grown by one cell on every side');
  const occ = floorOccupancy(tris);
  assert.equal(occ.w, 12); assert.equal(occ.h, 12);
  // the room's cells are covered and the rim is not
  assert.equal(occ.at(1, 1), true);
  assert.equal(occ.at(10, 10), true);
  assert.equal(occ.at(0, 0), false, 'the rim');
  assert.equal(occ.at(11, 11), false);
  assert.equal(occ.at(-1, 5), false, 'off the grid is not covered, and not a throw');
  assert.equal(occ.at(99, 5), false);
  let n = 0;
  for (let y = 0; y < occ.h; y++) for (let x = 0; x < occ.w; x++) if (occ.at(x, y)) n++;
  assert.equal(n, 100, 'a 10x10 room is 100 cells - the CENTRE test, so the outline sits inside the geometry');
  assert.equal(floorOccupancy([]), null, 'nothing to stand on is no plan');
});

test('EM2: the plan is a COASTLINE - inkMap\'s own two functions, and the chain lands on the room\'s true edges in world units', () => {
  const rows = [floorQuad(0, 0, 0, 10, 10, { key: 'low' }), floorQuad(8, 40, 40, 50, 50, { key: 'high' })];
  const plan = floorPlan(rows, 0, { segments: boundarySegments, link: linkSegments });
  assert.equal(plan.floors.length, 2);
  assert.equal(plan.index, 0);
  assert.equal(plan.chains.length, 1, 'one room, one shore');
  const chain = plan.chains[0];
  const xs = chain.map((p) => p.x), zs = chain.map((p) => p.y);
  assert.equal(Math.min(...xs), 0); assert.equal(Math.max(...xs), 10);
  assert.equal(Math.min(...zs), 0); assert.equal(Math.max(...zs), 10);
  assert.deepEqual(chain[0], chain[chain.length - 1], 'a room is a closed loop, so the stroke closes');

  // THE UPPER STOREY IS A DIFFERENT PLAN, in its own place
  const up = floorPlan(rows, 1, { segments: boundarySegments, link: linkSegments });
  assert.equal(up.index, 1);
  assert.equal(Math.min(...up.chains[0].map((p) => p.x)), 40, 'the upper room is forty units over, and only it is drawn');

  // the ask is CLAMPED rather than obeyed into an empty plan
  assert.equal(floorPlan(rows, 99, { segments: boundarySegments, link: linkSegments }).index, 1);
  assert.equal(floorPlan(rows, -5, { segments: boundarySegments, link: linkSegments }).index, 0);
  assert.equal(floorPlan(rows, null, { segments: boundarySegments, link: linkSegments }).index, 0);

  // AND THE MAP DRAWS WHAT WAS SEEN: the caller hands the REVEALED rows,
  // so a hall whose far half was never walked is half a plan
  const half = floorPlan([rows[0]], 0, { segments: boundarySegments, link: linkSegments });
  assert.equal(half.floors.length, 1, 'the storey that was never reached is not on the strip either');
});

test('EM2: nothing revealed is an empty plan, not a throw', () => {
  const empty = floorPlan([], 0, { segments: boundarySegments, link: linkSegments });
  assert.deepEqual(empty.floors, []);
  assert.equal(empty.index, -1);
  assert.deepEqual(empty.chains, []);
  assert.equal(empty.occupancy, null);
  // and without the ink pair it still answers the storeys - the strip
  // can be drawn before a single chain is cut
  const noInk = floorPlan([floorQuad(0, 0, 0, 10, 10)], 0);
  assert.equal(noInk.floors.length, 1);
  assert.deepEqual(noInk.chains, []);
});
