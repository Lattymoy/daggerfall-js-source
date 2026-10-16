// FB0930-FRAME (2026-09-30, a player's screenshot and performance trace from a loaded save in a dungeon): the desktop
// window's title still read "DFO Online - loading the saved game" long after the save had loaded - the world
// host names each boot step in the title and never took the last one down - and the frames ran ~151 ms, three
// quarters of them the foes' obstacle probes asking every door bucket its box. The first two pins are the boot's
// close; the rest are the collider's buckets filed by broad cell (bible/07-Rendering/Performance-Town.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** main.js's status closure, lifted and run against a stand-in document. */
function statusOf() {
  const src = read('src/main.js');
  const m = src.match(/const status = \(msg\) => \{\n([\s\S]*?)\n {2}\};/);
  assert.ok(m, 'main.js keeps its status closure');
  const doc = { title: 'DFO Online' };
  return { doc, status: new Function('document', `return (msg) => {\n${m[1]}\n};`)(doc) };
}

test('FB0930-FRAME: a boot step names itself in the title, and a null step is the bare name', () => {
  const { doc, status } = statusOf();
  status('loading the saved game');
  assert.equal(doc.title, 'DFO Online - loading the saved game');
  status(null);
  assert.equal(doc.title, 'DFO Online');
  status(undefined);
  assert.equal(doc.title, 'DFO Online', 'an absent step is the boot done too');
});

test('FB0930-FRAME: the world host takes its last boot step down where the loop is claimed, before the frame is defined', () => {
  const src = read('src/scenes/world.js');
  // at the boot's own level, between the loop's claim and frame() - never inside the frame, and the PERF1 pin's
  // closing shape (frameEnd, the re-arm, the first ask) is left as it stands
  assert.match(src, /\n {2}const _frameToken = claimFrame\(\);[^\n]*\n {2}status\(null\);[^\n]*\n {2}function frame\(now\) \{/);
  const statusCalls = [...src.matchAll(/(?<![.\w])status\(/g)].map((m) => m.index);
  assert.equal(statusCalls.at(-1), src.lastIndexOf('status(null);'), 'nothing names a boot step after the boot is done');
});

// ── FB0930-FRAME, the frame itself: the player's performance trace (a save loaded into a dungeon, 151 ms frames) put
// 76% of the frame in the foes' obstacle probes, and inside them the per-BUCKET cost - every action door, lever and
// platform is a collider bucket of its own, and every ray and sphere asked every one of them its box - outweighed the
// triangle tests. The standing buckets are filed on a broad XZ grid; a query asks the ones its own box reaches, in the
// walk's order. The sphere walks take the ray's stamp and a Y reject. These pin that every answer is the one the old
// walk gave - the old walk is the same collider with every box widened past the grid, which files every bucket as
// one every query asks, in the Map's order.

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const at = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
function quads(list) {
  const pos = [], idx = [];
  for (const [a, b, c, d] of list) { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); }
  return [new Float32Array(pos), new Uint32Array(idx)];
}
/** A slab door: 0.2 thick, 2 wide, 2.5 tall, its own box. */
const DOOR = quads([
  [[-0.1, 0, -1], [0.1, 0, -1], [0.1, 2.5, -1], [-0.1, 2.5, -1]], [[-0.1, 0, 1], [-0.1, 2.5, 1], [0.1, 2.5, 1], [0.1, 0, 1]],
  [[-0.1, 0, -1], [-0.1, 2.5, -1], [-0.1, 2.5, 1], [-0.1, 0, 1]], [[0.1, 0, -1], [0.1, 0, 1], [0.1, 2.5, 1], [0.1, 2.5, -1]],
  [[-0.1, 2.5, -1], [0.1, 2.5, -1], [0.1, 2.5, 1], [-0.1, 2.5, 1]],
]);
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
/** Two stacked levels of floor and ceiling in 4 m tiles with a ramp, walls with doorways, 60 door buckets baked into
 *  the world (as actionSystem registers them), a translated mover and a turned one. */
async function dungeon() {
  const { Collider } = await import('../../src/player/collider.js');
  seed = 7;
  const c = new Collider(() => -Infinity);
  const list = [];
  for (let l = 0; l < 2; l++) {
    const y = l * 5;
    for (let x = 0; x < 40; x += 4) for (let z = 0; z < 40; z += 4) {
      const ramp = x >= 16 && x < 24 && z < 8;
      const y0 = ramp ? y + (x - 16) * 0.125 : y, y1 = ramp ? y + (x + 4 - 16) * 0.125 : y;
      list.push([[x, y0, z], [x, y0, z + 4], [x + 4, y1, z + 4], [x + 4, y1, z]]);
      list.push([[x, y + 4, z], [x + 4, y + 4, z], [x + 4, y + 4, z + 4], [x, y + 4, z + 4]]);
    }
    for (let w = 12; w < 40; w += 12) for (let s = 0; s < 40; s += 4) {
      if (s % 12 === 4) continue;
      list.push([[w, y, s], [w, y, s + 4], [w, y + 4, s + 4], [w, y + 4, s]]);
      list.push([[s, y, w], [s, y + 4, w], [s + 4, y + 4, w], [s + 4, y, w]]);
    }
  }
  const [p, ix] = quads(list);
  c.addMesh('dungeon', p, ix, I);
  for (let d = 0; d < 60; d++) c.addMesh(`door${d}`, DOOR[0], DOOR[1], at(2 + rnd() * 36, Math.floor(rnd() * 2) * 5, 2 + rnd() * 36));
  const moverT = [20, 0, 30];
  c.addMesh('mover', DOOR[0], DOOR[1], I, () => moverT);
  const turn = [0, 0, -1, 0, 1, 0, 1, 0, 0];   // a quarter turn about y, column-major
  const turnedT = [30, 5, 10];
  c.addMesh('turned', DOOR[0], DOOR[1], I, () => turnedT, () => turn);
  return c;
}
/** The old walk: every box widened, so every bucket is asked by every query, in the Map's order. */
function widened(c) {
  for (const b of c._buckets.values()) { b.min = [-Infinity, -Infinity, -Infinity]; b.max = [Infinity, Infinity, Infinity]; }
  return c;
}
function probes(n) {
  seed = 99;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = [rnd() * 40, Math.floor(rnd() * 2) * 5 + 0.2 + rnd() * 2, rnd() * 40];
    const a = rnd() * Math.PI * 2, d = [Math.sin(a), (rnd() - 0.5) * 0.4, Math.cos(a)];
    const l = Math.hypot(...d);
    out.push({ p, d: d.map((v) => v / l), reach: [0.3, 2, 12, 60][i % 4], mv: [(rnd() - 0.5) * 0.4, -rnd() * 0.3, (rnd() - 0.5) * 0.4], r: 0.3 + rnd() });
  }
  return out;
}

test('FB0930-FRAME: the filed walk answers every ray, cast, sphere, contact and move bit for bit as the old walk did', async () => {
  const real = await dungeon(), old = widened(await dungeon());
  let hits = 0, contacts = 0;
  for (const { p, d, reach, mv, r } of probes(1200)) {
    const ha = real.raycastHit(p, d, reach), hb = old.raycastHit(p, d, reach);
    assert.deepEqual(ha, hb, `the ray from ${p}`);
    if (Number.isFinite(ha.dist)) hits++;
    assert.deepEqual(real.capsuleCast(p, [p[0], p[1] + 0.8, p[2]], 0.3, d, reach), old.capsuleCast(p, [p[0], p[1] + 0.8, p[2]], 0.3, d, reach), 'the capsule cast');
    assert.deepEqual(real.sphereCast(p, 0.25, d, reach), old.sphereCast(p, 0.25, d, reach), 'the sphere cast');
    assert.equal(real.sphereOverlaps(p, r), old.sphereOverlaps(p, r), 'the overlap');
    const feet = [p[0], p[1] - 0.2, p[2]];
    const ca = real.capsuleContact(feet, 1.8, 0.1), cb = old.capsuleContact(feet, 1.8, 0.1);
    assert.deepEqual(ca, cb, 'the contact');
    if (ca) contacts++;
    const fa = [...feet], fb = [...feet];
    assert.deepEqual(real.move(fa, mv[0], mv[1], mv[2], 1.8, true, true), old.move(fb, mv[0], mv[1], mv[2], 1.8, true, true), 'what the move reported');
    assert.deepEqual(fa, fb, 'and where it left the feet');
  }
  assert.ok(hits > 300 && contacts > 100, `a real sweep: ${hits} hits, ${contacts} contacts`);
});

test('FB0930-FRAME: the work - a short probe asks the buckets near it, the old walk asked every one', async () => {
  const real = await dungeon(), old = widened(await dungeon());
  const count = (c) => { let n = 0; for (const b of c._buckets.values()) { const t = b.t; b.t = () => { n++; return t(); }; } return () => n; };
  const nReal = count(real), nOld = count(old);
  const p = [5, 1, 5];
  real.capsuleCast(p, [5, 1.8, 5], 0.175, [1, 0, 0], 0.25);
  old.capsuleCast(p, [5, 1.8, 5], 0.175, [1, 0, 0], 0.25);
  assert.equal(nOld(), 27 * 63, 'the old walk: all 63 buckets for each of the 27 rays');
  assert.ok(nReal() <= 27 * 12, `the filed walk: the dungeon, the movers and the doors in reach (${nReal()} asks)`);
});

test('FB0930-FRAME: the walk keeps the Map\'s order - a tie goes to the bucket registered first, filed or not', async () => {
  const { Collider } = await import('../../src/player/collider.js');
  const wall = quads([[[5, 0, -1], [5, 0, 1], [5, 3, 1], [5, 3, -1]]]);
  const big = quads([[[5, 0, -400], [5, 0, 400], [5, 3, 400], [5, 3, -400]]]);   // too big to file (101 broad cells): asked by every query
  for (const [first, second] of [['door', 'huge'], ['huge', 'door']]) {
    const c = new Collider();
    c.raycast([0, 1, 0], [1, 0, 0], 1);   // a query on the empty collider: the filing is dropped and made again below
    const add = (k) => (k === 'door' ? c.addMesh(k, wall[0], wall[1], I) : c.addMesh(k, big[0], big[1], I));
    add(first); add(second);
    assert.equal(c.raycastHit([0, 1, 0], [1, 0, 0], 20).key, first, `the coplanar tie goes to ${first}, registered first`);
    c.removeBucket(first); add(first);   // re-registered: now last in the Map, as a moving door re-registers each frame
    assert.equal(c.raycastHit([0, 1, 0], [1, 0, 0], 20).key, second, `and to ${second} once ${first} is registered again`);
  }
});

test('FB0930-FRAME: the filing follows the buckets - a new mesh, a grown bucket, a removed one, a box widened by hand', async () => {
  const { Collider } = await import('../../src/player/collider.js');
  const c = new Collider();
  const wall = (x) => quads([[[x, 0, -1], [x, 0, 1], [x, 3, 1], [x, 3, -1]]]);
  assert.equal(c.raycast([0, 1, 0], [1, 0, 0], 50), Infinity, 'nothing yet');
  c.addMesh('a', ...wall(30), I);
  assert.ok(Math.abs(c.raycast([0, 1, 0], [1, 0, 0], 50) - 30) < 1e-9, 'a bucket added after a query is filed');
  c.addMesh('a', ...wall(10), I);
  assert.ok(Math.abs(c.raycast([0, 1, 0], [1, 0, 0], 50) - 10) < 1e-9, 'a bucket grown after a query is filed again');
  c.removeBucket('a');
  assert.equal(c.raycast([0, 1, 0], [1, 0, 0], 50), Infinity, 'a removed bucket is gone from the filing');
});

test('FB0930-FRAME: a sphere pushed past the gathered box asks again - a comb of walls carries it into the next broad cell', async () => {
  const { Collider } = await import('../../src/player/collider.js');
  const build = () => {
    const c = new Collider();
    const comb = [];
    for (const x of [6, 6.3, 6.6, 6.9, 7.2, 7.5]) comb.push([[x, 0, -1], [x, 0, 1], [x, 3, 1], [x, 3, -1]]);
    c.addMesh('comb', ...quads(comb), I);   // each wall pushes the sphere +x by its penetration, in order: 1.8 m in one resolve
    c.addMesh('door', ...quads([[[8.05, 0, -1], [8.05, 0, 1], [8.05, 3, 1], [8.05, 3, -1]]]), I);   // over the broad cell's edge at x = 8
    return c;
  };
  const real = build(), old = widened(build());
  const a = [6.05, 1, 0], b = [6.05, 1, 0];
  real._resolveSphere(a, 0.35, {});
  old._resolveSphere(b, 0.35, {});
  assert.deepEqual(a, b, 'the same centre as the old walk');
  assert.ok(a[0] < 7.85 - 1e-6, `the door beyond the gathered box pushed it back (${a[0]})`);
});

test('FB0930-FRAME: the sphere\'s Y reject keeps the skin - a floor in the skin shell still grounds, a floor past it does not', async () => {
  const { Collider } = await import('../../src/player/collider.js');
  const c = new Collider();
  c.addMesh('floor', ...quads([[[-2, 0, -2], [-2, 0, 2], [2, 0, 2], [2, 0, -2]]]), I);
  const inShell = {}, beyond = {};
  c._resolveSphere([0, 0.35 + 0.015, 0], 0.35, inShell);
  c._resolveSphere([0, 0.35 + 0.025, 0], 0.35, beyond);
  assert.equal(inShell.grounded, true, 'a floor 0.015 under the sphere, inside the 0.02 skin: grounded');
  assert.ok(!beyond.grounded, 'a floor 0.025 under it: not');
});

test('FB0930-FRAME: a wrapped stamp zeroes every bucket\'s marks, not only the one walked when it wrapped', async () => {
  const { Collider, _setRayStampForTest } = await import('../../src/player/collider.js');
  const c = new Collider();
  c.addMesh('a', ...quads([[[5, 0, -1], [5, 0, 1], [5, 3, 1], [5, 3, -1]]]), I);
  c.addMesh('b', ...quads([[[-5, 0, -1], [-5, 0, 1], [-5, 3, 1], [-5, 3, -1]]]), I);
  _setRayStampForTest(0x7ffffffd);
  assert.ok(Number.isFinite(c.raycast([0, 1, 0], [1, 0, 0], 20, { only: ['a'] })), 'a is walked at the stamp before the wrap');
  c.raycast([0, 1, 0], [-1, 0, 0], 20, { only: ['b'] });   // the wrap comes on b's walk
  _setRayStampForTest(0x7ffffffd);   // ...and the count climbs back to a's old mark
  assert.ok(Number.isFinite(c.raycast([0, 1, 0], [1, 0, 0], 20, { only: ['a'] })), 'a\'s wall is still met - its marks were zeroed in the new epoch');
  _setRayStampForTest(0);
});

test('FB0930-FRAME: a capsule cast with no axis casts nine rays - the clear-path probe\'s other eighteen were the same nine', async () => {
  const { Collider } = await import('../../src/player/collider.js');
  const c = new Collider();
  c.addMesh('w', ...quads([[[3, 0, -1], [3, 0, 1], [3, 3, 1], [3, 3, -1]]]), I);
  let rays = 0;
  const hit = c.raycastHit.bind(c);
  c.raycastHit = (...a) => { rays++; return hit(...a); };
  const p = [0, 1, 0];
  const three = c.capsuleCast(p, p, 0.175, [1, 0, 0], 10);
  assert.equal(rays, 9, 'one sample of nine');
  rays = 0;
  assert.deepEqual(c.capsuleCast(p, p, 0.175, [1, 0, 0], 10, 1), three, 'the same answer one sample gives');
  c.capsuleCast(p, [0, 1.5, 0], 0.175, [1, 0, 0], 10);
  assert.equal(rays - 9, 27, 'a capsule with an axis keeps its three samples');
});
