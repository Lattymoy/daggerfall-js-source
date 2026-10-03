// AUDIT REST-PARTY C (2026-10-03, bible/06-Systems/Rest-Arc.md section 4, the placement law; REST3's dungeon fires).
// The law placed a fire a metre from a brazier (the layout's fires were measured from the start alone, and the
// fallbacks asked nothing - C2), read a stair's tread and a 25.8 degree ramp as a floor (one ray, ny > 0.9 - C3), put
// the fire of a marker on a lift's platform in the shaft under it (the floor ray read the dungeon's bucket alone - C4),
// and gave a dungeon whose brazier stands by the door N fires past it and an elite two deep fires and none at the door
// (C5); and tools/dungeonFireProbe.mjs read the doors, the fires and the collider three ways the game does not, so it
// could not say where the game stands them (C6). Each is RUN here over synthetic layouts and a real Collider - the
// game's files are not in this tree - and the law stays one answer on every client (the same inputs, the same fires).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DFIRE, chooseFires, placeDungeonFires, landCandidates, colliderFireProbe, fireLayoutInputs, fireCandidates,
} from '../src/world/dungeonFires.js';
import { hostFireCollider, layoutHearths, probeFires } from '../tools/dungeonFireProbe.mjs';
import { Collider } from '../src/player/collider.js';
import { RDB_SIDE, ACTION_FLAGS } from '../src/world/rdbLayout.js';
import { DOOR_TYPE } from '../src/world/meshReader.js';

const I = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const T = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const at = (x, y = 0, z = 0, start = false) => ({ pos: [x, y, z], start, water: -Infinity });
const mk = (record, x, z, y = 0.5) => ({ record, x, y, z });
const open = { floor: () => ({ y: 0, ny: 1 }), room: () => true };   // a flat open floor at y 0 everywhere

/** Triangles: quads and boxes into one { positions, indices } (a model, or a bucket's mesh). */
function mesh() {
  const positions = [], indices = [];
  const quad = (a, b, c, d) => { const n = positions.length / 3; positions.push(...a, ...b, ...c, ...d); indices.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const box = (x0, y0, z0, x1, y1, z1) => {
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]); quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]); quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]);
  };
  /** A hall `2h` square and `t` high, centred on the origin: floor, ceiling, four walls. */
  const hall = (h, t) => {
    quad([-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h]); quad([-h, t, -h], [h, t, -h], [h, t, h], [-h, t, h]);
    quad([-h, 0, -h], [h, 0, -h], [h, t, -h], [-h, t, -h]); quad([-h, 0, h], [h, 0, h], [h, t, h], [-h, t, h]);
    quad([-h, 0, -h], [-h, 0, h], [-h, t, h], [-h, t, -h]); quad([h, 0, -h], [h, 0, h], [h, t, h], [h, t, -h]);
  };
  return { positions, indices, quad, box, hall };
}
const collider = (...buckets) => {
  const c = new Collider(() => -Infinity);
  for (const [key, m] of buckets) c.addMesh(key, m.positions, m.indices, I);
  return c;
};
/** A row of `n` blocks along x, the first the starting block (REST3's own test layout). */
function row(n) {
  return Array.from({ length: n }, (_, i) => ({
    name: i === n - 1 ? 'B0000001.RDB' : `N00000${i}.RDB`, originX: i * RDB_SIDE, originZ: 0, isStartingBlock: i === 0,
    layout: { waterLevel: 10000, markers: [mk(i === 0 ? 10 : 19, 5, 5), mk(19, 30, 30)], startMarkers: i === 0 ? [mk(10, 5, 5)] : [] },
  }));
}

test('AUDIT REST-PARTY C2: the entrance fire stands 25 m clear of every fire the layout stands - in reach, in the starting block and anywhere', () => {
  const start = [0, 0, 0];
  // in reach: the candidate nearest the door is 15.5 m from a brazier just past the reach - the clear one 24 m off is it
  let fires = chooseFires([at(10, 0, 0, true), at(0, 0, -24, true), at(300)], { seed: 1, start, existing: [[25.5, 0, 0]], count: 2 });
  assert.deepEqual(fires, [[0, 0, -24], [300, 0, 0]]);
  // the starting block's fallback (nothing in reach): the nearest is half a metre from a brazier - the clear one stands
  fires = chooseFires([at(28, 0, 0, true), at(0, 0, -28.2, true), at(300)], { seed: 1, start, existing: [[28.5, 0, 0]], count: 2 });
  assert.deepEqual(fires[0], [0, 0, -28.2]);
  // the last fallback (no starting block's candidate either) asks the same
  fires = chooseFires([at(28), at(0, 0, -28.2), at(300)], { seed: 1, start, existing: [[28.5, 0, 0]], count: 2 });
  assert.deepEqual(fires[0], [0, 0, -28.2]);
  assert.ok((fires[0][0] - 28.5) ** 2 + fires[0][2] ** 2 >= DFIRE.entranceM ** 2, 'never within 25 m of a layout fire');
  // a brazier 26 m in and the start marker valid: the entrance fire still stands on the start - the door's own spot
  assert.deepEqual(chooseFires([at(0, 0, 0, true), at(25, 0, 0, true), at(200)], { seed: 1, start, existing: [[26, 0, 0]], count: 2 }), [[0, 0, 0], [200, 0, 0]]);
});

test('AUDIT REST-PARTY C2/C5: a layout fire nearer the door than any clear candidate IS the entrance fire, and counts - the law lights none 200 m in for it', () => {
  // the only candidate in reach is 1.5 m from a brazier 25.5 m in; the clear ones are 200 and 400 m in
  const fires = chooseFires([at(24, 0, 0, true), at(200), at(400)], { seed: 1, start: [0, 0, 0], existing: [[25.5, 0, 0]], count: 2 });
  assert.deepEqual(fires, [[400, 0, 0]], 'the brazier is the door\'s; one more - the deep fire, measured from the door');
});

test('AUDIT REST-PARTY C5: a brazier by the door counts toward N - N - 1 placed past it; an elite\'s half keeps the brazier as its entrance', () => {
  const blocks = row(12);   // 11 inner blocks -> N 4, an elite 2
  const base = { blocks, probe: open, seed: 1234 };
  const brazier = [[8, 0, 8]];
  assert.equal(placeDungeonFires(base).length, 4);
  const withB = placeDungeonFires({ ...base, existing: brazier });
  assert.equal(withB.length, 3, 'N in all: the brazier and three');
  assert.ok(withB.every((p) => (p[0] - 8) ** 2 + (p[2] - 8) ** 2 >= DFIRE.spacingM ** 2), 'none by the brazier');
  const elite = placeDungeonFires({ ...base, elite: true });
  assert.equal(elite.length, 2);
  assert.deepEqual(elite[0], [5, 0, 5], 'an elite\'s first is the entrance\'s');
  const eliteB = placeDungeonFires({ ...base, elite: true, existing: brazier });
  assert.deepEqual(eliteB, [elite[1]], 'the brazier is the entrance\'s, the deep fire the other');
  // an elite of one with a brazier at its door: the brazier is the one
  const small = row(4);   // 3 inner -> N 2, an elite 1
  assert.equal(placeDungeonFires({ blocks: small, probe: open, seed: 5, elite: true }).length, 1);
  assert.deepEqual(placeDungeonFires({ blocks: small, probe: open, seed: 5, elite: true, existing: brazier }), []);
  // a brazier far from the door is not the entrance's: the full count, the entrance fire on the start
  const far = placeDungeonFires({ ...base, existing: [[RDB_SIDE * 6, 0, 30]] });
  assert.deepEqual(far[0], [5, 0, 5]);
});

test('AUDIT REST-PARTY C3: a stair\'s tread and a ramp are no floor - the floor sampled half a metre round on eight bearings, level to 5 cm, flat past 0.99', () => {
  // a 30 m hall with a staircase in it: 0.6 m treads, 0.25 m rises, 8 m wide
  const st = mesh(); st.hall(15, 8);
  for (let i = 0; i < 12; i++) st.box(-4, 0, i * 0.6, 4, (i + 1) * 0.25, (i + 1) * 0.6);
  const pr = colliderFireProbe(collider(['dungeon', st]));
  assert.deepEqual(pr.floor([0, 1, 2.1]), { y: 1, ny: 1 }, 'a tread is flat under one ray');
  const kept = landCandidates([{ pos: [0, 1, 2.1], water: -Infinity }, { pos: [-10, 0.5, -10], water: -Infinity }], { probe: pr });
  assert.deepEqual(kept.map((k) => k.pos), [[-10, 0, -10]], 'the tread refused, the hall\'s floor kept');
  // ramps: 20 degrees fails the normal; 7 degrees passes it (cos 7 = 0.9925) and fails the level (6 cm in half a metre)
  for (const deg of [20, 7]) {
    const rm = mesh(); rm.hall(15, 8);
    const tan = Math.tan((deg * Math.PI) / 180);
    rm.quad([-4, 0, 0], [4, 0, 0], [4, tan * 10, 10], [-4, tan * 10, 10]);
    const rp = colliderFireProbe(collider(['dungeon', rm]));
    const f = rp.floor([0, tan * 5 + 0.3, 5]);
    assert.ok(Math.abs(f.y - tan * 5) < 1e-6, `${deg}: the ray lands on the ramp`);
    assert.equal(rp.room([0, f.y, 5]), true, `${deg}: room round it - only the floor's law refuses it`);
    assert.deepEqual(landCandidates([{ pos: [0, tan * 5 + 0.3, 5], water: -Infinity }], { probe: rp }), [], `${deg} degrees`);
  }
  // the normal alone: a level floor whose face tilts (ny 0.95) is no floor - at the centre, or anywhere round it
  const cand = [{ pos: [3, 0.5, 3], water: -Infinity }];
  assert.deepEqual(landCandidates(cand, { probe: { floor: () => ({ y: 0, ny: 0.95 }), room: () => true } }), []);
  assert.deepEqual(landCandidates(cand, { probe: { floor: (p) => ({ y: 0, ny: p[0] === 3 && p[2] === 3 ? 1 : 0.95 }), room: () => true } }), []);
  assert.deepEqual(landCandidates(cand, { probe: { floor: (p) => ({ y: 0, ny: p[0] === 3 && p[2] === 3 ? 0.95 : 1 }), room: () => true } }), []);
  assert.equal(landCandidates(cand, { probe: open }).length, 1, 'level and flat: kept');
  // within 5 cm all round is level (a seam); 6 cm is not
  const step = (dy) => ({ floor: (p) => ({ y: p[0] > 3 ? dy : 0, ny: 1 }), room: () => true });
  assert.equal(landCandidates(cand, { probe: step(0.04) }).length, 1);
  assert.equal(landCandidates(cand, { probe: step(0.06) }).length, 0);
  assert.ok(DFIRE.flatNy >= 0.99 && DFIRE.levelM <= 0.05 && DFIRE.levelR >= 0.5);
});

test('AUDIT REST-PARTY C4: a marker on a lift\'s platform stands no fire in the shaft under it - the floor is the first thing under the point, and it must be the dungeon\'s own', () => {
  const room = mesh(); room.hall(10, 10);
  const lift = mesh(); lift.box(-2, 2.8, -2, 2, 3, 2);   // a platform at rest 3 m up: a mover, a bucket of its own (actionSystem addAction)
  const pr = colliderFireProbe(collider(['dungeon', room], ['act:0:7', lift]));
  assert.equal(pr.floor([0, 3.5, 0]), null, 'the platform is first under it, and no floor of the dungeon\'s');
  const kept = landCandidates([{ pos: [0, 3.5, 0], water: -Infinity }, { pos: [6, 0.5, 6], water: -Infinity }], { probe: pr });
  assert.deepEqual(kept.map((k) => k.pos), [[6, 0, 6]], 'the lift\'s marker refused; the floor beside it kept');
  // the same platform in the dungeon's own mesh (a static ledge) is a floor - the bucket decides, not the shape
  const ledge = mesh(); ledge.hall(10, 10); ledge.box(-2, 2.8, -2, 2, 3, 2);
  assert.deepEqual(colliderFireProbe(collider(['dungeon', ledge])).floor([0, 3.5, 0]), { y: 3, ny: 1 });
});

test('AUDIT REST-PARTY C6: the law\'s doors and fires read one way - every action door and the DungeonExit doors alone; the layout\'s fires at their foot', () => {
  const blocks = [{
    name: 'N1.RDB', originX: 100, originZ: 50, isStartingBlock: true,
    layout: {
      markers: [], actionDoors: [{ matrix: T(1, 0, 2) }],
      exitDoors: [{ doorType: DOOR_TYPE.DUNGEON_EXIT, matrix: T(3, 0.5, 4) }, { doorType: DOOR_TYPE.DUNGEON_EXIT + 1, matrix: T(5, 0, 6) }],
    },
  }];
  const hearths = [{ x: 1, y: 2, z: 3, foot: 1.2 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: 9, foot: 7, placed: true }];
  assert.deepEqual(fireLayoutInputs(blocks, hearths), { doors: [[101, 0, 52], [103, 0.5, 54]], existing: [[1, 1.2, 3], [4, 5, 6]] });
  assert.deepEqual(fireLayoutInputs(null, null), { doors: [], existing: [] });
});

test('AUDIT REST-PARTY C6: tools/dungeonFireProbe.mjs stands what the game stands - the host\'s buckets, the DungeonExit doors, the fires\' feet', () => {
  const room = mesh(); room.hall(20, 10);
  const lift = mesh(); lift.box(-2, 2.8, -2, 2, 3, 2);
  const models = new Map([[1, room], [2, lift]]);
  const blocks = [{
    name: 'N0.RDB', originX: 0, originZ: 0, isStartingBlock: true,
    layout: {
      waterLevel: 10000,
      placements: [{ modelIdNum: 1, matrix: I, position: 1 }, { modelIdNum: 2, matrix: I, position: 2, action: { actionFlag: ACTION_FLAGS.Translation } }],
      actionDoors: [],
      exitDoors: [{ doorType: DOOR_TYPE.DUNGEON_EXIT + 1, matrix: T(7, 0, 5) }],   // a door face 2 m from the start - not an exit
      flats: [{ archive: 210, record: 0, x: -15, y: 1, z: -15 }, { archive: 210, record: 2, x: 0, y: 1, z: 15 }],
      markers: [mk(10, 5, 5), mk(19, 0, 0, 3.5)],   // the start, and a treasure marker on the lift
      startMarkers: [mk(10, 5, 5)],
    },
  }];
  const col = hostFireCollider(blocks, (id) => models.get(id) ?? null);
  assert.equal(col.raycastHit([0, 5, 0], [0, -1, 0], 10).key, 'act:0:2', 'the mover in its own bucket, as the host hangs it');
  assert.equal(col.raycastHit([9, 5, 9], [0, -1, 0], 10).key, 'dungeon');
  const sizeOf = (archive, record) => (archive === 210 && record === 0 ? { w: 1, h: 2 } : null);
  assert.deepEqual(layoutHearths(blocks, sizeOf).map((h) => [h.x, h.foot ?? h.y, h.z]), [[-15, 0, -15]], 'the brazier at its foot; 210/2 is no hearth');
  const r = probeFires(col, blocks, { seed: 3, sizeOf });
  assert.equal(r.braziers, 1);
  assert.equal(r.valid, 1, 'the start marker kept beside a door face that is not an exit; the lift\'s marker refused');
  assert.deepEqual(r.fires, [[5, 0, 5]]);
  // the game's own call over the same inputs, read the game's way, stands the same fires
  const { doors, existing } = fireLayoutInputs(blocks, layoutHearths(blocks, sizeOf));
  assert.deepEqual(placeDungeonFires({ blocks, probe: colliderFireProbe(col), doors, existing, seed: 3 }), r.fires);
});

test('AUDIT REST-PARTY C: one answer on every client - the same layout twice, a copy of it, the layout\'s fires in any order; the landing asks each candidate alone', () => {
  const blocks = row(12);
  const existing = [[8, 0, 8], [RDB_SIDE * 9, 0, 30], [RDB_SIDE * 5, -30, 5]];
  const a = placeDungeonFires({ blocks, probe: open, seed: 77, existing });
  assert.deepEqual(placeDungeonFires({ blocks, probe: open, seed: 77, existing }), a);
  assert.deepEqual(placeDungeonFires({ blocks: structuredClone(blocks), probe: open, seed: 77, existing: structuredClone(existing) }), a);
  for (const order of [[2, 1, 0], [1, 2, 0], [2, 0, 1]]) {
    assert.deepEqual(placeDungeonFires({ blocks, probe: open, seed: 77, existing: order.map((i) => existing[i]) }), a, `existing ${order}`);
  }
  // the candidates are the layout's, in its order (the hash breaks a tie by that index - 4.3); landing is per candidate
  const st = mesh(); st.hall(15, 8);
  for (let i = 0; i < 12; i++) st.box(-4, 0, i * 0.6, 4, (i + 1) * 0.25, (i + 1) * 0.6);
  const pr = colliderFireProbe(collider(['dungeon', st]));
  const cands = [[0, 1, 2.1], [-10, 0.5, -10], [10, 0.5, -10], [0, 3.2, 7.5], [-14.5, 0.5, 0], [10, 0.5, 10]].map((pos, i) => ({ pos, water: -Infinity, i }));
  const keep = (list) => landCandidates(list, { probe: pr }).map((k) => `${k.i}:${k.pos.join(',')}`).sort();
  const once = keep(cands);
  assert.ok(once.length >= 2 && once.length < cands.length, 'some kept, some refused');
  assert.deepEqual(keep([...cands].reverse()), once);
  assert.deepEqual(keep([cands[3], cands[0], cands[5], cands[1], cands[4], cands[2]]), once);
  assert.deepEqual(fireCandidates(blocks).map((c) => c.pos), fireCandidates(structuredClone(blocks)).map((c) => c.pos));
});
