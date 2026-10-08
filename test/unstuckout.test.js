// UNSTUCK-OUT (FIELD BUGS 2026-10-08, SaberGGaming: "Invisible walls around mountains often gets you stuck. Using the
// overhead map and traveling around caused this ... I had to end up dying to respawn somewhere else cause unstuck didnt
// work"; Sahh: "I got stuck inside a mountain during fast travel"; bible/03-World/Player-Arc.md UNSTUCK-OUT). World of
// Daggerfall's mountain rocks are meshes scaled by hundreds; the collider holds both faces of a skin and the renderer
// culls the back ones, so from inside a rock its walls are invisible and hold the body in - and `/unstuck` refused
// outdoors. The nearest open ground (player/enterExit.js openGroundNear) answers both: a fast-travel landing held in a
// rock stands there instead, and `/unstuck` outdoors stands the body there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Collider } from '../src/player/collider.js';
import { openGroundNear, heldInSolid, OPEN_GROUND_RINGS } from '../src/player/enterExit.js';
import { CAPSULE_HEIGHT } from '../src/player/motor.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A closed box of rock [x0..x1] x [y0..y1] x [z0..z1], twelve triangles. */
function rock(col, key, [x0, y0, z0], [x1, y1, z1]) {
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const i = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  col.addMesh(key, p, i, I);
}
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('UNSTUCK-OUT the nearest open ground: inside a mountain\'s rock (a real closed mesh, the collider\'s own parity law) the body is held; the first spot on the rings out where no rock holds its feet or its head and its torso touches no mesh, on the terrain\'s floor; a rock open beneath holds what stands under its crown; nothing built, or no open ground within the last ring, answers null (mutants: the feet unasked, the head unasked, the torso unasked, the floor ignored)', () => {
  const ground = (x) => 10 + x * 0.01;   // a gentle slope: the floor read, not assumed
  const col = new Collider((x, z) => (x > 300 ? -Infinity : ground(x)));
  rock(col, 'mountain', [-20, 0, -20], [20, 400, 20]);   // a rock standing in the ground, its crown 400 up
  const at = [0, ground(0), 0];
  assert.equal(heldInSolid(col, at), true, 'inside the rock: held');
  const open = openGroundNear(col, 0, 0);
  assert.ok(open, 'open ground found');
  assert.equal(Math.hypot(open[0], open[2]), 32, 'the first ring past the rock\'s 20 (rings 0, 4, 8, 16 are in it)');
  assert.equal(open[1], ground(open[0]), 'on the terrain\'s floor');
  assert.equal(heldInSolid(col, open), false);
  // the first spot of that ring is east, at the ring's start
  assert.deepEqual(open.map((v) => Math.round(v * 1000) / 1000), [32, Math.round(ground(32) * 1000) / 1000, 0]);
  // a head-height overhang (a closed slab whose underside clears the torso and not the head) holds the head: not open
  const lid = new Collider(() => 0);
  rock(lid, 'slab', [-5, CAPSULE_HEIGHT - 0.45, -5], [5, CAPSULE_HEIGHT + 2, 5]);
  assert.equal(heldInSolid(lid, [0, 0, 0]), true, 'the head is in it');
  assert.notDeepEqual(openGroundNear(lid, 0, 0), [0, 0, 0], 'the head counts');
  // a body whose torso touches a mesh (an upright wall through the spot - no solid, so only the sphere sees it)
  const wall = new Collider(() => 0);
  wall.addMesh('wall', [0, 0, -3, 0, 0, 3, 0, 3, 3, 0, 3, -3], [0, 1, 2, 0, 2, 3], I);
  assert.equal(heldInSolid(wall, [0, 0, 0]), false, 'a wall holds nothing');
  assert.notDeepEqual(openGroundNear(wall, 0, 0), [0, 0, 0], 'the torso counts');
  // a boulder ankle-high (under the torso's reach) holds the feet and not the head
  const low = new Collider(() => 0);
  rock(low, 'boulder', [-3, 0, -3], [3, 0.45, 3]);
  assert.equal(heldInSolid(low, [0, 0, 0]), true, 'the feet are in it');
  assert.notDeepEqual(openGroundNear(low, 0, 0), [0, 0, 0], 'the feet count');
  // open ground where the body stands: it stays
  assert.deepEqual(openGroundNear(new Collider(() => 5), 7, 9), [7, 5, 9]);
  // the sea's floor is no ground: a host's `dry` skips it (the first dry ring past the rock is east of x 50)
  const sloped = new Collider((x) => x - 50);
  rock(sloped, 'mountain', [-20, -100, -20], [20, 400, 20]);
  const dry = openGroundNear(sloped, 0, 0, { dry: (floor) => floor >= 0 });
  assert.ok(dry && dry[1] >= 0 && dry[0] >= 50, `on dry ground: ${dry}`);
  assert.ok(openGroundNear(sloped, 0, 0)[1] < 0, 'unasked, the sea\'s floor would do');
  // nothing built: no floor, no spot
  assert.equal(openGroundNear(new Collider(() => -Infinity), 0, 0), null);
  // a rock wider than the last ring: none
  const vast = new Collider(() => 0);
  rock(vast, 'massif', [-600, 0, -600], [600, 50, 600]);
  assert.equal(openGroundNear(vast, 0, 0), null);
  assert.equal(OPEN_GROUND_RINGS.at(-1), 256);
});

test('UNSTUCK-OUT the world host: a fast-travel landing held in a rock stands on the nearest open ground; /unstuck outdoors stands the body there, said, and says so when there is none - only on foot in the open world, alive, not mid-journey (mutants: the landing unchecked, the outdoor arm unwired, its guard)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /import \{ floorLanding, doorWorldPosition, openGroundNear, heldInSolid \} from '\.\.\/player\/enterExit\.js';/);
  assert.match(w, /if \(walkMode && \(!local \|\| ground\) && heldInSolid\(collider, pos\)\) \{\n\s*const open = openGroundNear\(collider, pos\[0\], pos\[2\], \{ dry: \(floor\) => floor >= tvSeaY\(\) \}\);\n\s*if \(open\) \{\n[^\n]*\n\s*pos = open;/);
  const landing = w.indexOf('heldInSolid(collider, pos)');
  assert.ok(landing > w.indexOf('if (walkMode && landing && pos[1] - raw[1] > OBSTRUCTED_ABOVE) {') && landing < w.indexOf('const resolved = resolveArrival ? await resolveArrival(pos) : null;'), 'after TL2, before the arrival is committed');
  assert.match(w, /const freed = !hour && !moved \? unstuckOutdoors\(\) : false;/);
  assert.match(w, /text: moved \? 'You find your way back outside\.' : freed \? 'You find your footing on open ground\.' : 'There is no open ground near enough to send you to\.',/);
  // the outdoor arm, run out of its own text
  const lines = w.split('\n');
  const a = lines.findIndex((l) => l === '  function unstuckOutdoors() {');
  assert.ok(a >= 0);
  const b = lines.findIndex((l, i) => i > a && l === '  }');
  const make = new Function('modes', 'walkMode', 'playerSpawned', 'worldMoveBusy', 'playerEntity', 'openGroundNear', 'collider', 'player', 'cam', 'tvSeaY',
    `${lines.slice(a, b + 1).join('\n')}\nreturn unstuckOutdoors;`);
  const col = new Collider(() => 0);
  rock(col, 'mountain', [-20, 0, -20], [20, 400, 20]);
  const run = (o = {}) => {
    const player = { pos: [0, 0, 0], swimming: !!o.swimming, spawn(x, y, z) { this.pos = [x, y, z]; } };
    const cam = { pos: [0, 0, 0] };
    const ok = make(o.modes ?? { mode: 'exterior' }, o.walk ?? true, o.spawned ?? true, () => o.busy ?? false, { health: o.health ?? 10 }, openGroundNear, col, player, cam, () => o.sea ?? -1)();
    return { ok, player, cam };
  };
  const r = run();
  assert.equal(r.ok, true);
  assert.equal(Math.hypot(r.player.pos[0], r.player.pos[2]), 32, 'stood on open ground');
  assert.deepEqual(r.cam.pos, r.player.pos);
  for (const [o, why] of [[{ modes: { mode: 'dungeon' } }, 'indoors is the door\'s'], [{ walk: false }, 'not on foot'], [{ spawned: false }, 'no body yet'], [{ busy: true }, 'mid-journey'], [{ health: 0 }, 'dead'], [{ swimming: true }, 'in the water'], [{ sea: 1 }, 'all the ground under the sea']]) {
    const x = run(o);
    assert.equal(x.ok, false, why);
    assert.deepEqual(x.player.pos, [0, 0, 0], `${why}: unmoved`);
  }
});
