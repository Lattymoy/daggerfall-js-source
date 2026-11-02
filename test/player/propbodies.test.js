// PROP-BODIES (2026-10-19, the owner: "Implement collision for all props"): a solid flat stands a BODY - an upright
// cylinder at its foot, riding the cover index beside its cover (ai/cover.js, a proxy marked `body`) - and the player,
// on foot or mounted, is kept out of it after the collider's move (player/bodyClamp.js, motor.js's step). Which flats:
// a tree its trunk, a still nature record and every prop that is not nature its foot measured off its own picture,
// never the flora that sways (world/propBodies.js). bible/03-World/Player-Arc.md PROP-BODIES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PlayerMotor, FIXED_DT, CAPSULE_RADIUS, STEP_OFFSET, CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { createCoverIndex, FELLED, COVER_TRUNK_R, COVER_RADIUS_FRAC, COVER_CROWN_FROM, COVER_HEIGHT_FRAC } from '../../src/ai/cover.js';
import { flatBody, flatBodies, footShare, jungleBody } from '../../src/world/propBodies.js';
import { keepOffBodies } from '../../src/player/bodyClamp.js';
import { JUNGLE_MEASURES } from '../../src/world/jungle/jungleModels.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const IDLE = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const RUN = { ...IDLE, forward: 1, run: true };

/** a motor on a flat floor, its collider carrying a cover index with `bodies` (pixel-local, the set's frame `t`) */
function walker(bodies = [], t = null) {
  const col = new Collider(() => 0);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  col.addMesh('floor', [-200, 0, -200, 200, 0, -200, 200, 0, 200, -200, 0, 200], [0, 1, 2, 0, 2, 3], I);
  col.cover = createCoverIndex();
  col.cover.add('pixel', bodies, t);
  const m = new PlayerMotor(col);
  m.spawn(0, 1, 0);
  for (let i = 0; i < 30; i++) m.update(FIXED_DT, IDLE, 0);
  return m;
}
const trunk = (x, z, r = 0.3, h = 3, lift = 0) => ({ c: [x, 0, z], r, h, lift, body: true });
const from = (m, b) => Math.hypot(m.pos[0] - b.c[0], m.pos[2] - b.c[2]);

// ─── THE MOTOR ───────────────────────────────────────────────────────

test('PROP-BODIES the motor: running at a trunk, the feet stop at its foot less the capsule\'s radius, every step - and at a slant they slide round it and go on; a felled tree, a crown overhead and a set\'s frame all as they stand (mutants: the motor\'s call gone; a body\'s reach without the capsule; the felled tree a body; the set\'s frame unread)', () => {
  const b = trunk(0, 6);
  const m = walker([b]);
  const R = b.r + CAPSULE_RADIUS;
  // yaw 0 runs along +z, straight at the trunk
  for (let i = 0; i < 240; i++) {
    m.update(FIXED_DT, RUN, 0);
    assert.ok(from(m, b) >= R - 1e-4, `step ${i}: ${from(m, b).toFixed(4)} m from the trunk`);
  }
  assert.ok(Math.abs(from(m, b) - R) < 0.02 && m.pos[2] < b.c[2], 'it reached the trunk and stopped there');
  // a slant: the feet slide round it and carry on past
  const s = trunk(0.2, 6);
  const m2 = walker([s]);
  for (let i = 0; i < 300; i++) { m2.update(FIXED_DT, RUN, 0); assert.ok(from(m2, s) >= s.r + CAPSULE_RADIUS - 1e-4); }
  assert.ok(m2.pos[2] > s.c[2] + 2, `slid round and on (z ${m2.pos[2].toFixed(2)})`);
  // a felled tree is no body; a crown lifted over the head is none
  const f = trunk(0, 6);
  FELLED.add(f.c);
  const m3 = walker([f]);
  for (let i = 0; i < 240; i++) m3.update(FIXED_DT, RUN, 0);
  assert.ok(m3.pos[2] > 8, 'through where a felled tree stood');
  const m4 = walker([trunk(0, 6, 0.3, 5, CAPSULE_HEIGHT + 0.5)]);
  for (let i = 0; i < 240; i++) m4.update(FIXED_DT, RUN, 0);
  assert.ok(m4.pos[2] > 8, 'under a crown');
  // a set in a pixel's frame: the body where the frame puts it
  const framed = trunk(0, 1);
  const m5 = walker([framed], () => [0, 0, 5]);
  for (let i = 0; i < 240; i++) m5.update(FIXED_DT, RUN, 0);
  assert.ok(Math.abs(Math.hypot(m5.pos[0], m5.pos[2] - 6) - (framed.r + CAPSULE_RADIUS)) < 0.02, `stopped at the framed trunk (z ${m5.pos[2].toFixed(2)})`);
});

test('PROP-BODIES the motor: nothing holds a body that nothing holds a wall for - a journey\'s pace, a climb, a held body; a cover index with no bodies moves nothing (mutants: the journey held)', () => {
  const b = trunk(0, 6);
  const m = walker([b]);
  m.travelling = () => true;
  for (let i = 0; i < 240; i++) m.update(FIXED_DT, RUN, 0);
  assert.ok(m.pos[2] > 8, 'a journey passes');
  const free = walker([]), plain = walker([trunk(40, 40)]);
  for (let i = 0; i < 120; i++) { free.update(FIXED_DT, RUN, 0.3); plain.update(FIXED_DT, RUN, 0.3); }
  assert.deepEqual([...plain.pos], [...free.pos], 'a body far off: the same walk to the bit');
});

// ─── THE CLAMP ───────────────────────────────────────────────────────

/** a motor's shape, the clamp's alone: a collider that moves wherever it is asked */
const shape = (bodies, pos, prev, extra = {}) => {
  const cover = createCoverIndex();
  cover.add('k', bodies);
  return { pos: Float32Array.from(pos), _prevPos: Float32Array.from(prev), height: 1.8, grounded: true, jumping: false, swimming: false, levitating: false,
    _airVelX: 0, _airVelZ: 0, collider: { cover, move(p, dx, dy, dz) { p[0] += dx; p[1] += dy; p[2] += dz; } }, ...extra };
};

test('PROP-BODIES the clamp: from outside to the body\'s edge along the line from its middle; from inside (a spawn, a teleport) never deeper than it stood, and out freely - never a trap; the momentum into it taken away, along it kept; a rock under the feet in a jump none (mutants: from inside out to the edge at once; the momentum kept; the span unread)', () => {
  const b = trunk(0, 0, 0.5);
  const R = 0.5 + CAPSULE_RADIUS;
  let m = shape([b], [0.3, 0, 0.4], [0.9, 0, 1.2]);
  keepOffBodies(m, CAPSULE_RADIUS);
  assert.ok(Math.abs(Math.hypot(m.pos[0], m.pos[2]) - R) < 1e-6, 'to its edge (a float32 position)');
  assert.ok(Math.abs(Math.atan2(m.pos[2], m.pos[0]) - Math.atan2(0.4, 0.3)) < 1e-6, 'along the line from its middle');
  // began inside at 0.3 m from its middle: a step deeper is put back to 0.3, a step out is let be
  m = shape([b], [0.2, 0, 0], [0.3, 0, 0]);
  keepOffBodies(m, CAPSULE_RADIUS);
  assert.ok(Math.abs(m.pos[0] - 0.3) < 1e-6 && m.pos[2] === 0, 'no deeper than it stood - not thrown out to the edge');
  m = shape([b], [0.45, 0, 0], [0.3, 0, 0]);
  keepOffBodies(m, CAPSULE_RADIUS);
  assert.equal(m.pos[0], Math.fround(0.45), 'out freely');
  // airborne at it: the momentum into it gone, along it kept
  m = shape([b], [0.7, 0, 0], [0.9, 0, 0], { _airVelX: -4, _airVelZ: 2 });
  keepOffBodies(m, CAPSULE_RADIUS);
  assert.equal(m._airVelX, 0);
  assert.equal(m._airVelZ, 2);
  // a rock 0.8 m tall under feet 1 m up: none; at the feet, it holds
  const rock = trunk(0, 0, 0.5, 0.8);
  m = shape([rock], [0.3, 1, 0], [1.5, 1, 0]);
  keepOffBodies(m, CAPSULE_RADIUS);
  assert.equal(m.pos[0], Math.fround(0.3), 'jumped over');
  m = shape([rock], [0.3, 0, 0], [1.5, 0, 0]);
  keepOffBodies(m, CAPSULE_RADIUS);
  assert.ok(m.pos[0] > 0.84, 'walked into');
  // the hands hold no body: a climb, a wall, a parkour move; nor a body the motor holds
  for (const held of [{ climb: { isClimbing: true } }, { _wall: {} }, { _pkMove: {} }, { freezeMotor: 2 }]) {
    m = shape([b], [0.3, 0, 0], [1.5, 0, 0], held);
    keepOffBodies(m, CAPSULE_RADIUS);
    assert.equal(m.pos[0], Math.fround(0.3), JSON.stringify(held));
  }
});

// ─── WHICH FLATS ─────────────────────────────────────────────────────

/** a texture file's shape: one record, `rows` (top first) each how many of its ten texels are picture */
const pic = (rows) => ({ getDFBitmap: () => ({ width: 10, height: rows.length, data: Uint8Array.from(rows.flatMap((n) => Array.from({ length: 10 }, (_, x) => (x >= 5 - Math.floor(n / 2) && x < 5 - Math.floor(n / 2) + n ? 7 : 0)))) }) });

test('PROP-BODIES the foot, measured: the median, over the rows between a step over the base and a capsule\'s height, of how much of each is picture - never the rows a foot steps over nor those over the head; kept a record and height at a time (mutants: the step\'s rows read; the rows over the head read; the widest row, not the median; the extent, not the picture)', () => {
  // 40 rows over 4 m: a row 0.1 m. Rows 0-21 over 1.8 m and rows 35-39 under the step whole - read, either would move the
  // median; rows 22-34 the band, seven of 2 and six of 6: the median 2, the widest 6
  const band = [2, 6, 2, 6, 2, 6, 2, 6, 2, 6, 2, 6, 2];
  const t = pic([...Array(22).fill(10), ...band, ...Array(5).fill(10)]);
  const size = { w: 3, h: 4 };
  assert.equal(footShare(t, 0, size), 0.2);
  assert.equal(footShare(t, 0, size), 0.2, 'kept');
  assert.equal(flatBody([0, 0, 0], t, 205, 0, size).r, 0.2 * 3 / 2);
  // a row that is two thin roots 8 texels apart is two texels of picture, not eight
  const roots = { getDFBitmap: () => ({ width: 10, height: 20, data: Uint8Array.from({ length: 200 }, (_, i) => (i % 10 === 1 || i % 10 === 8 ? 7 : 0)) }) };
  assert.equal(footShare(roots, 0, size), 0.2);
  assert.equal(footShare(null, 0, size), 2 * COVER_RADIUS_FRAC, 'no picture: cover\'s share');
  assert.ok(STEP_OFFSET === 0.5 && CAPSULE_HEIGHT === 1.8, 'the band the rows above are cut for');
});

test('PROP-BODIES which flats: a tree its trunk - the tree table\'s and the records Windfall sways Full; a still record and every prop its measured foot; the flora Windfall sways Low or Medium none, whatever the pixel\'s climate; nothing under a step; never a person, a town animal, a light, a marker or treasure; a jungle tree its own girth (mutants: the Full tier flora; the flora solid; the flora by the pixel\'s climate; the step unasked; the archives that are never cover a body)', () => {
  const t = pic(Array(20).fill(6));
  const size = { w: 2, h: 3 };
  const tree = flatBody([0, 0, 0], t, 504, 13, { w: 3.9, h: 7.4 }, { tree: true });
  assert.deepEqual([tree.r, tree.h], [Math.min(3.9 * COVER_RADIUS_FRAC, COVER_TRUNK_R), 7.4 * COVER_CROWN_FROM]);
  const full = flatBody([0, 0, 0], t, 504, 11, { w: 6.1, h: 10.3 });   // a tree the tree table does not name, Full
  assert.deepEqual([full.r, full.h], [COVER_TRUNK_R, 10.3 * COVER_CROWN_FROM]);
  assert.equal(flatBody([0, 0, 0], t, 504, 21, size), null, 'a tall flower (Low)');
  assert.equal(flatBody([0, 0, 0], t, 504, 27, size), null, 'a bush (Medium)');
  assert.equal(flatBody([0, 0, 0], t, 500, 1, size), null, 'the rainforest\'s cover - the jungle\'s floor, in a mountain pixel too');
  const rock = flatBody([0, 0, 0], t, 504, 5, size);
  assert.deepEqual([rock.r, rock.h, rock.body], [0.6, 3 * COVER_HEIGHT_FRAC, true], 'a still record its measured foot');
  assert.equal(flatBody([0, 0, 0], t, 205, 0, size).r, 0.6, 'a prop its measured foot');
  assert.equal(flatBody([0, 0, 0], t, 205, 0, { w: 2, h: 0.5 }), null, 'under a step');
  for (const archive of [199, 201, 210, 216]) assert.equal(flatBody([0, 0, 0], t, archive, 0, size), null, `archive ${archive}`);
  assert.equal(flatBody(Object.assign([0, 0, 0], { noCover: true }), t, 205, 0, size), null, 'a person');
  const centers = [[0, 0, 0], [1, 0, 1]];
  assert.deepEqual(flatBodies(t, 205, 0, size, centers).map((b) => b.c), centers, 'its feet by reference');
  for (let s = 0; s < JUNGLE_MEASURES.length; s++) {
    const j = jungleBody([0, 0, 0], s, 1.2);
    assert.deepEqual([j.r, j.h, j.body], [JUNGLE_MEASURES[s].trunk * 1.2, JUNGLE_MEASURES[s].crownFrom * 1.2, true]);
  }
});

// ─── THE INDEX ───────────────────────────────────────────────────────

test('PROP-BODIES the index: a body is filed beside the cover, never in it - no sight ray or missile meets it, the cover\'s counts are the cover\'s; `near` finds a body by its reach and its set\'s frame, once; a set taken away or traded in place takes its bodies with it (mutants: a body filed as cover; near without the reach)', () => {
  const cover = createCoverIndex({ enabled: () => true });
  const b = trunk(0, 5, 0.4);
  cover.add('p', [{ c: [10, 0, 0], r: 0.5, h: 2, lift: 0 }, b], () => [1, 0, 0]);
  assert.equal(cover.size(), 1, 'the cover\'s own');
  assert.equal(cover.bodies(), 1);
  assert.equal(cover.hit([1, 1, 0], [0, 0, 1], 20), Infinity, 'a ray straight through the body meets nothing');
  const found = [];
  cover.near([1.5, 0, 5], 0.35, (it, x, y, z) => found.push([it, x, y, z]));
  assert.deepEqual(found, [[b, 1, 0, 5]], 'once, its foot in the world\'s frame');
  found.length = 0;
  cover.near([1.8, 0, 5], 0.35, (it) => found.push(it));
  assert.equal(found.length, 0, 'past its reach');
  cover.near([1.7, 0, 5], 0.35, (it) => found.push(it));
  assert.equal(found.length, 1, 'within its radius and the reach');
  // traded in place (a re-skin) and taken away
  const staged = cover.staged(() => [0, 0, 0]);
  cover.fill(staged, [trunk(0, 0)]);
  cover.place('p', staged);
  assert.equal(cover.bodies(), 1);
  cover.remove('p');
  assert.equal(cover.bodies(), 0);
});

// ─── THE HOSTS ───────────────────────────────────────────────────────

test('PROP-BODIES the hosts: the motor clamps after the arena\'s clamp, each step; every host files its flats\' bodies beside their cover - the stream once a group by the record\'s own size, the jungle\'s trunks, the scaled flats; the city, the rooms and the dungeon (mutants: by source)', () => {
  assert.match(rd('src/player/motor.js'), /if \(this\.arena\) this\._keepInArena\(\);[^\n]*\n\s*keepOffBodies\(this, CAPSULE_RADIUS\);/);
  const w = rd('src/scenes/pixelBuild.js');
  assert.match(w, /await naturePicture\([^\n]*\n\s*coverItems\.push\(\.\.\.flatBodies\(t, archive, record, plain, centers, \{ tree: g\.natureSet\.has\(archive\) && isTreeRecord\(g\.natureBase\(archive\), record\) \}\)\);/);
  assert.match(w, /const species = g\.species, record = JUNGLE_SPECIES\[species\]\.record;\n\s*g\.centers\.forEach\(\(c, i\) => coverItems\.push\(jungleBody\(c, species, g\.own\[i\]\)\)\);/);
  assert.match(w, /coverItems\.push\(coverProxy\(c, size\)\);\n\s*coverItems\.push\(\.\.\.flatBodies\(t, archive, record, size, centers, \{ tree: natureSet\.has\(archive\) && isTreeRecord\(natureBase\(archive\), record\) \}\)\);/);
  assert.match(rd('src/scenes/exterior.js'), /collider\.cover\.add\('prop-bodies', flatBodies\(t, archive, record, plain, centers, \{ tree: archive === natureArchive && isTreeRecord\(natureArchive, record\) \}\)\);/);
  assert.match(rd('src/scenes/interiorContext.js'), /collider\.cover\.add\('prop-bodies', flatBodies\(t, archive, record, size, centers\)\);/);
  assert.match(rd('src/scenes/dungeonContext.js'), /coverItems\.push\(\.\.\.flatBodies\(t, archive, record, size, based\)\);/);
});
