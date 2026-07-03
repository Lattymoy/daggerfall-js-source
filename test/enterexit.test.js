import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTER_DOOR_OFFSET, EXIT_DOOR_OFFSET, MARKER_UP_OFFSET, DUNGEON_EXIT_OFFSET,
  doorWorldPosition, doorWorldNormal, interiorLanding, exteriorLanding,
  dungeonEntranceLanding, climbLadder,
} from '../src/player/enterExit.js';
import { trs } from '../src/world/mat4.js';

const approx = (a, b, eps = 1e-4) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('enterExit: verbatim offsets', () => {
  approx(ENTER_DOOR_OFFSET, 0.35 + 0.4); // radius + 0.4
  approx(EXIT_DOOR_OFFSET, 0.35 * 3); // radius * 3
  approx(MARKER_UP_OFFSET, 1.8 * 0.6); // height * 0.6
});

test('enterExit: door transform under the placement matrix', () => {
  // Door centre/normal arrive PRE-scaled and Y-negated (meshReader
  // stores door verts in mesh convention); the world transform is the
  // placement matrix alone. Ry(90) carries local +x onto -z.
  const door = {
    matrix: trs(10, 0, 5, 0, 90, 0),
    centre: { x: 1, y: 2, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    size: { x: 0.1, y: 2.2, z: 1 },
  };
  const p = doorWorldPosition(door);
  approx(p[1], 2);
  approx(Math.hypot(p[0] - 10, p[2] - 5), 1);
  approx(p[2] - 5, -1); // rotation direction pinned
  const n = doorWorldNormal(door);
  approx(Math.hypot(n[0], n[1], n[2]), 1);
  approx(n[1], 0);
  approx(Math.abs(n[0]), 1); // +z normal swings onto x under Ry(90)
});

test('enterExit: landings - marker snap, door offset, closest pick', () => {
  const I = trs(0, 0, 0, 0, 0, 0);
  const mkDoor = (x, z, nx, nz) => ({
    matrix: I,
    centre: { x, y: 0, z }, // mesh-convention units, identity placement
    normal: { x: nx, y: 0, z: nz },
    size: { x: 0.1, y: 2.2, z: 1 },
  });

  // Two interior doors; the enter marker sits near door B, so the
  // landing must use B even though the exterior door is nearer A.
  const doorA = mkDoor(0, 0, 0, 1);
  const doorB = mkDoor(10, 0, 1, 0);
  const landing = interiorLanding([1, 0, 0], [[9, 0, 0.5]], [doorA, doorB]);
  approx(landing[0], 10 + 1 * ENTER_DOOR_OFFSET);
  approx(landing[2], 0);

  // No doors: marker + up * 1.08.
  const fallback = interiorLanding([1, 0, 0], [[9, 0, 0.5]], []);
  approx(fallback[1], 0 + MARKER_UP_OFFSET);
  assert.equal(interiorLanding([0, 0, 0], [], []), null);

  // Exit: closest exterior sibling + normal * 1.05.
  const out = exteriorLanding([9.6, 0, 0.2], [doorA, doorB]);
  approx(out[0], 10 + EXIT_DOOR_OFFSET);
  approx(out[2], 0);
});

test('enterExit: dungeon exit landing - offset and lowest-door pick', () => {
  approx(DUNGEON_EXIT_OFFSET, 0.35 + 0.1);
  const I = trs(0, 0, 0, 0, 0, 0);
  const high = { matrix: trs(0, 5, 0, 0, 0, 0), centre: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 } };
  const low = { matrix: I, centre: { x: 10, y: 1, z: 0 }, normal: { x: 1, y: 0, z: 0 } };
  const landing = dungeonEntranceLanding([high, low]);
  approx(landing.pos[0], 10 + DUNGEON_EXIT_OFFSET);
  approx(landing.pos[1], 1);
  approx(landing.normal[0], 1);
  assert.equal(dungeonEntranceLanding([]), null);
});

test('enterExit: ladder climb - verbatim marker rules', () => {
  const M = { LADDER_BOTTOM: 21, LADDER_TOP: 22 };
  const markers = [
    { type: 21, x: 0, y: 0.5, z: 0 },
    { type: 22, x: 0, y: 4.2, z: 0 },
    { type: 22, x: 30, y: 9, z: 0 }, // a farther top must lose
  ];
  // Below the top -> teleports TO the top.
  assert.deepEqual(climbLadder([0.4, 1.0, 0], markers, M), [0, 4.2, 0]);
  // Above the bottom (standing at the top) -> teleports to the bottom.
  assert.deepEqual(climbLadder([0.2, 4.2, 0], markers, M), [0, 0.5, 0]);
  // No markers -> null.
  assert.equal(climbLadder([0, 1, 0], [], M), null);
});
