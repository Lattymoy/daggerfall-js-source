// FB1020c BENCH-DOORS (FIELD BUGS 2026-10-20c, the Discord: "the crafting station in towns dont have any craft buttons,
// just buttons to store goods"). The joinery (CARP-YARD, bible/03-World/Merchant-Yards.md) is the one crafting station
// that stands in a town's street. A press on its carpenter, its board or its bench opens the Stores page landed on The
// Workbench (scenes/merchantYardsHost.js activate -> scenes/world.js openYardBench), and the page asks whether the player
// stands at it (world.js workbenchHere -> merchantYardsHost.js workbenchNear). That question measured the feet from the
// bench's middle alone, against YARD_REACH (6.4 m) - and the carpenter stands 8.55 m from it, the board 9.55 m: a press
// on either opened a page whose workbench was Away (no saw, no craft, only the Stores' Put in and Take out). The station
// is where its doors answer: every box a press on opens the bench, each measured at its nearest point across the ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMerchantYards, yardToScene, YARD_REACH, YARD_BENCH_RISE } from '../../src/scenes/merchantYardsHost.js';
import { CARPENTER_YARD, benchBoxOf, signBoxOf, yardPoints } from '../../src/world/merchantYards/merchantYardModels.js';
import { pickActivatableHit, answersPress } from '../../src/player/activate.js';

const KEEPER = { name: 'Aldric Thane', sex: 'male', variant: 2 };
const GROUND = 2, EYE = 1.7;
const noWalls = { raycast: () => Infinity, raycastHit: () => ({ dist: Infinity, key: null }) };

function rig(sites) {
  const opened = [];
  const renderer = {
    textures: new Set(), uploadTexture: () => {}, createMesh: () => ({}), destroyMesh: () => {}, drawMesh: () => {},
    createBillboardBatch: (a, r, size) => ({ a, r, size }), destroyBillboardBatch: () => {},
  };
  const collider = { addMesh: () => {}, removeBucket: () => {} };
  const tex = { getSize: () => ({ width: 40, height: 76 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 3 };
  const y = createMerchantYards({
    renderer, collider: () => collider, getTexture: async () => tex, uploadRecordFrame: () => {},
    sites: () => sites, groundAt: () => GROUND, eye: () => [0, 3, 0], feet: () => null, horseArt: () => true,
    open: () => true, say: () => {}, midText: () => {}, now: () => 1000,
    bench: (site) => { opened.push(site.key); return true; },
  });
  return { y, opened };
}
const joinery = (yaw) => ({ key: `7:carpenter:${yaw}`, kind: 'carpenter', x: 100, z: 50, yaw, comp: 0, regionIndex: 17, race: 'Breton', keeper: KEEPER });
/** The points a player looks at to press each door, in the scene: the carpenter's middle, the board's, the bench's two ends
 *  and its middle. */
function looks(site) {
  const at = [site.x, GROUND, site.z], k = CARPENTER_YARD.keeper, sb = signBoxOf('carpenter'), bb = benchBoxOf();
  const mz = (bb[2] + bb[5]) / 2;
  return [
    yardToScene(at, site.yaw, k[0], 1.2, k[1]),
    yardToScene(at, site.yaw, (sb[0] + sb[3]) / 2, (sb[1] + sb[4]) / 2, (sb[2] + sb[5]) / 2),
    yardToScene(at, site.yaw, bb[0] + 0.1, 0.95, mz), yardToScene(at, site.yaw, bb[3] - 0.1, 0.95, mz), yardToScene(at, site.yaw, 0, 0.95, mz),
  ];
}
/** A press from feet `f` aimed at `p`: the part the ray answers, if it answers, with no wall in the way. */
function press(y, f, p) {
  const eye = [f[0], f[1] + EYE, f[2]], d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], l = Math.hypot(...d);
  const hit = pickActivatableHit(eye, d.map((v) => v / l), y.targets(), noWalls);
  return answersPress(hit) ? hit : null;
}

test('BENCH-DOORS THE DOORS: a joinery\'s boxes for the eye are its carpenter, its board and its bench - no horse, no wagon - and a press on each, with no row lit or the bench\'s, opens the workbench (mutants: none - the doors the station is measured from)', async () => {
  const site = joinery(0);
  const { y, opened } = rig([site]);
  y.frame(); await new Promise((r) => setTimeout(r, 0)); y.frame();
  assert.deepEqual(yardPoints('carpenter').horses, []);
  assert.deepEqual(yardPoints('carpenter').wagons, []);
  const parts = y.targets().map((t) => t.key.split('|')[1]);
  assert.deepEqual(parts, ['keeper', 'sign', 'bench']);
  for (const part of parts) for (const verb of [null, 'bench']) assert.equal(y.activate(`yard:${site.key}|${part}`, 'grab', verb), true);
  assert.equal(opened.length, 6, 'every door opens the workbench');
  y.dispose();
});

test('BENCH-DOORS THE PRESS AND THE STATION AGREE: wherever a press on the carpenter, the board or the bench is answered, the street\'s workbench question answers that joinery - the player in front of the carpenter, in the gateway and outside the gate at the board among them, at any turn of the yard (mutants: the bench\'s middle again; the bench alone; the carpenter or the board no door; a box\'s corner for its nearest point)', () => {
  for (const yaw of [0, 90]) {
    const site = joinery(yaw);
    const { y } = rig([site]);
    y.frame();
    const at = [site.x, GROUND, site.z], k = CARPENTER_YARD.keeper, [atKeeper, atSign] = looks(site);
    // the three a player meets first: in front of the carpenter, in the gateway (pressing him), outside the gate at the board
    const front = yardToScene(at, yaw, k[0], 0, k[1] + 1.2), gate = yardToScene(at, yaw, 0, 0, CARPENTER_YARD.fence.z1), out = yardToScene(at, yaw, 0, 0, CARPENTER_YARD.fence.z1 + 2);
    for (const [f, p, part, what] of [[front, atKeeper, 'keeper', 'in front of the carpenter'], [gate, atKeeper, 'keeper', 'in the gateway'], [out, atSign, 'sign', 'outside the gate, at the board']]) {
      const hit = press(y, f, p);
      assert.equal(hit?.key.split('|')[1], part, `${what}: the press is answered`);
      assert.equal(y.workbenchNear(f), site, `${what}: the workbench is here (yaw ${yaw})`);
    }
    // the sweep: every feet point on a half-metre grid round the yard, each door looked at
    const count = { keeper: 0, sign: 0, bench: 0 }, away = [];
    for (let dx = -14; dx <= 14; dx += 0.5) {
      for (let dz = -14; dz <= 14; dz += 0.5) {
        const f = [site.x + dx, GROUND, site.z + dz];
        for (const p of looks(site)) {
          const hit = press(y, f, p);
          if (!hit) continue;
          count[hit.key.split('|')[1]]++;
          if (y.workbenchNear(f) !== site) away.push([dx, dz, hit.key.split('|')[1]]);
        }
      }
    }
    assert.ok(count.keeper > 0 && count.sign > 0 && count.bench > 0, `each door pressed (${JSON.stringify(count)})`);
    assert.deepEqual(away.slice(0, 5), [], `a press answered where the workbench was Away: ${away.length} of them (yaw ${yaw})`);
    y.dispose();
  }
});

test('BENCH-DOORS NOTHING PAST EVERY DOOR: a point past YARD_REACH of all three boxes, one over the roof or under the floor, no feet, a Stable - none is at a workbench (mutants: the rise unread)', () => {
  const site = joinery(0), stable = { key: '7:stable', kind: 'stable', x: 160, z: 50, yaw: 0, comp: 0, regionIndex: 17, race: 'Breton', keeper: KEEPER };
  const { y } = rig([site, stable]);
  y.frame();
  const boxes = y.targets().filter((t) => t.key.startsWith(`yard:${site.key}|`)).map((t) => t.aabb);
  const reach = (f) => Math.min(...boxes.map((b) => Math.hypot(Math.max(b.min[0] - f[0], 0, f[0] - b.max[0]), Math.max(b.min[2] - f[2], 0, f[2] - b.max[2]))));
  const westmost = boxes.reduce((a, b) => (b.min[0] < a.min[0] ? b : a)), z = (westmost.min[2] + westmost.max[2]) / 2;
  const past = [westmost.min[0] - YARD_REACH - 0.01, GROUND, z], at = [westmost.min[0] - YARD_REACH + 0.01, GROUND, z];
  assert.ok(reach(past) > YARD_REACH && reach(at) <= YARD_REACH);
  assert.equal(y.workbenchNear(at), site, 'at the reach');
  assert.equal(y.workbenchNear(past), null, 'past every door');
  const mid = yardToScene([site.x, GROUND, site.z], 0, 0, 0, (benchBoxOf()[2] + benchBoxOf()[5]) / 2);
  assert.equal(y.workbenchNear([mid[0], GROUND + YARD_BENCH_RISE + 0.01, mid[2]]), null, 'over it, on its roof');
  assert.equal(y.workbenchNear([mid[0], GROUND - YARD_BENCH_RISE - 0.01, mid[2]]), null, 'under it');
  assert.equal(y.workbenchNear(null), null);
  assert.equal(y.workbenchNear([160, GROUND, 50]), null, 'the Stable stands no bench');
  y.dispose();
});
