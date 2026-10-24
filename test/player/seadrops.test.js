// SEA-DROPS (2026-10-23, the owner: "while at sea players encounter on and off persistent frame drops"): a mover's
// bucket - a boat's, carried by her turn and her way (AUDIT NAV1 #12) - is handed to a query only where its box, as it
// stands, reaches the query's; a posed one's box is made once a move (the world host's sync asks posesMoved) and kept.
// Measured in the real game (bible/07-Rendering/Performance-Priority.md SEA-DROPS): at sea every ray of the deep's foes
// asked every bucket of my boat and of each ship within COLLIDE_RANGE - 101 of them - and a fresh water's spawns cast
// 2,400-3,200 rays a frame. These pin that every answer is the old walk's, and the work the new one leaves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../src/player/collider.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function quads(list) {
  const pos = [], idx = [];
  for (const [a, b, c, d] of list) { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); }
  return [new Float32Array(pos), new Uint32Array(idx)];
}
/** A hull's box, closed, `l` long, `w` wide, `h` high, its keel's middle at `c` (where she was baked), and a deck over it. */
function hull([cx, cy, cz], l = 24, w = 6, h = 4) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - l / 2, z1 = cz + l / 2, y0 = cy, y1 = cy + h;
  return quads([
    [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]],
    [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]],
    [[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
    [[x0 - 1, y1 + 2, z0 + 4], [x1 + 1, y1 + 2, z0 + 4], [x1 + 1, y1 + 2, z0 + 8], [x0 - 1, y1 + 2, z0 + 8]],   // a sail's yard, wider than her
  ]);
}
let seed = 5;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
/** A turn about y by `yaw`, rolled by `roll` about her own length - column-major, as csaCarry's R. */
function turn(yaw, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
  // Ry * Rz, columns
  return [cy * cr, sr, -sy * cr, -cy * sr, cr, sy * sr, sy, 0, cy];
}
/** A sea: a floor and two quays standing, and a fleet of hulls baked where they lay, each carried by a pose of its own
 *  (her T and R, written in place as the world host's csaCarry writes them). `posed`: laid as the sync lays them;
 *  `old`: every box widened, so every bucket is asked by every query, in the Map's order - the old walk. */
function sea({ posed = true, old = false, counted = null } = {}) {
  seed = 5;
  const c = new Collider(() => 0);
  c.addMesh('floor', ...quads([[[-400, -2, -400], [-400, -2, 400], [400, -2, 400], [400, -2, -400]]]), I);
  c.addMesh('quay-a', ...hull([-60, -2, 40], 80, 10, 6), I);
  c.addMesh('quay-b', ...hull([90, -2, -70], 60, 8, 6), I);
  const fleet = [];
  for (let k = 0; k < 8; k++) {
    const at = [(rnd() - 0.5) * 160, 0, (rnd() - 0.5) * 160];
    const s = { at, T: [0, 0, 0], R: null, yaw: rnd() * 6, way: [(rnd() - 0.5) * 2, 0, (rnd() - 0.5) * 2], key: `boat:${k}` };
    const tr = counted ? () => { counted.n++; return s.T; } : () => s.T;
    c.addMesh(s.key, ...hull(at), I, tr, () => s.R, posed);
    fleet.push(s);
  }
  if (old) for (const b of c._buckets.values()) { b.min = [-Infinity, -Infinity, -Infinity]; b.max = [Infinity, Infinity, Infinity]; }
  return { c, fleet };
}
/** Frame `f` of the fleet's sailing: each hull turned and rolled about her own middle and carried along her way - T so her
 *  bake's middle stands where she sails now (world = R b + T). */
function sail(fleet, f) {
  for (const s of fleet) {
    const R = turn(s.yaw + f * 0.02, Math.sin(f * 0.3 + s.yaw) * 0.08);
    const c = [s.at[0] + s.way[0] * f, Math.sin(f * 0.2) * 0.4, s.at[2] + s.way[2] * f];
    const m = s.at;
    s.T[0] = c[0] - (R[0] * m[0] + R[3] * m[1] + R[6] * m[2]);
    s.T[1] = c[1] - (R[1] * m[0] + R[4] * m[1] + R[7] * m[2]);
    s.T[2] = c[2] - (R[2] * m[0] + R[5] * m[1] + R[8] * m[2]);
    s.R = f % 7 === 3 ? null : R;   // now and then a frame of pure way (csaCarry's plain path): T alone
    if (s.R === null) { s.T[0] = c[0] - m[0]; s.T[1] = c[1] - m[1]; s.T[2] = c[2] - m[2]; }
  }
}
/** Probes: a third about a hull where she stands (`fleet`), a third over the sea and the quays, a third (unless `near`)
 *  300-800 m off - the deep's foes' place. */
function probes(n, near, fleet) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const far = !near && i % 3 === 0, boat = i % 3 === 1 ? fleet[i % fleet.length] : null;
    const r = far ? 300 + rnd() * 500 : boat ? rnd() * 16 : rnd() * 110, a = rnd() * Math.PI * 2;
    const o = boat ? [boat.T[0] + boat.at[0], 0, boat.T[2] + boat.at[2]] : [0, 0, 0];   // near her middle (her way; a small turn about it)
    const p = [o[0] + Math.cos(a) * r, -1 + rnd() * 9, o[2] + Math.sin(a) * r];
    const b = rnd() * Math.PI * 2, d = boat ? [o[0] - p[0] + (rnd() - 0.5) * 8, 2 - p[1], o[2] - p[2] + (rnd() - 0.5) * 8] : [Math.sin(b), (rnd() - 0.5) * 0.8, Math.cos(b)];   // about a hull: at her
    const l = Math.hypot(...d);
    out.push({ p, d: d.map((v) => v / l), reach: [0.3, 2, 12, 60, 150][i % 5], mv: [(rnd() - 0.5) * 0.6, -rnd() * 0.3, (rnd() - 0.5) * 0.6], r: 0.3 + rnd() * 1.5 });
  }
  return out;
}

test('SEA-DROPS: a fleet carried by its turns and its ways answers every ray, cast, sphere, contact and move as the old walk did - posed, its boxes kept between its host\'s moves, and laid without, asked where it stands (mutants: the turn unread in a mover\'s box; the posed boxes never made again)', () => {
  for (const posed of [true, false]) {
    const real = sea({ posed }), old = sea({ old: true });
    let hits = 0, contacts = 0, onBoats = 0;
    for (let f = 0; f < 40; f++) {
      sail(real.fleet, f); sail(old.fleet, f);
      real.c.posesMoved();
      if (f === 20) {   // a hull grown mid-voyage: a sail set on her (addMesh into a standing filing)
        for (const w of [real, old]) w.c.addMesh(w.fleet[2].key, ...quads([[[w.fleet[2].at[0] - 8, 9, w.fleet[2].at[2]], [w.fleet[2].at[0] + 8, 9, w.fleet[2].at[2]], [w.fleet[2].at[0] + 8, 16, w.fleet[2].at[2]], [w.fleet[2].at[0] - 8, 16, w.fleet[2].at[2]]]]), I, () => w.fleet[2].T, () => w.fleet[2].R, posed && w === real);
        for (const b of old.c._buckets.values()) { b.min = [-Infinity, -Infinity, -Infinity]; b.max = [Infinity, Infinity, Infinity]; }
      }
      for (const { p, d, reach, mv, r } of probes(60, f % 4 === 0, real.fleet)) {
        const ha = real.c.raycastHit(p, d, reach), hb = old.c.raycastHit(p, d, reach);
        assert.deepEqual(ha, hb, `${posed ? 'posed' : 'unposed'}: frame ${f}, the ray from ${p}`);
        if (Number.isFinite(ha.dist)) { hits++; if (ha.key.startsWith('boat:')) onBoats++; }
        assert.deepEqual(real.c.capsuleCast(p, [p[0], p[1] + 0.8, p[2]], 0.3, d, reach, 3), old.c.capsuleCast(p, [p[0], p[1] + 0.8, p[2]], 0.3, d, reach, 3), 'the capsule cast');
        assert.deepEqual(real.c.sphereCast(p, 0.25, d, reach), old.c.sphereCast(p, 0.25, d, reach), 'the sphere cast');
        assert.equal(real.c.sphereOverlaps(p, r), old.c.sphereOverlaps(p, r), 'the overlap');
        const feet = [p[0], p[1] - 0.2, p[2]];
        const ca = real.c.capsuleContact(feet, 1.8, 0.1), cb = old.c.capsuleContact(feet, 1.8, 0.1);
        assert.deepEqual(ca, cb, 'the contact');
        if (ca) contacts++;
        const fa = [...feet], fb = [...feet];
        assert.deepEqual(real.c.move(fa, mv[0], mv[1], mv[2], 1.8, true, true), old.c.move(fb, mv[0], mv[1], mv[2], 1.8, true, true), 'what the move reported');
        assert.deepEqual(fa, fb, 'and where it left the feet');
      }
    }
    assert.ok(hits > 400 && onBoats > 100 && contacts > 50, `a real sweep: ${hits} hits, ${onBoats} on the boats, ${contacts} contacts`);
  }
});

test('SEA-DROPS: the work - a posed fleet\'s poses are read once a move, a query far from every hull is handed none of them, and one beside a hull is handed her; a box is kept until its host says it moved (mutants: the posed boxes never made again; a grown posed box kept; a posed box past the query handed; their union unasked is the cost alone - equivalent, as recorded)', () => {
  const counted = { n: 0 };
  const { c, fleet } = sea({ counted });
  sail(fleet, 1);
  c.posesMoved();
  const movers = (list) => list.filter((b) => b.key.startsWith('boat:'));
  c._near(-1, 1, -1, 1, []);
  assert.equal(counted.n, fleet.length, 'each pose read once, at the first query after the move');
  counted.n = 0;
  for (let i = 0; i < 200; i++) {
    const a = i * 0.7, x = Math.cos(a) * 600, z = Math.sin(a) * 600;
    assert.deepEqual(movers(c._near(x - 2, x + 2, z - 2, z + 2, [])), [], 'a query 600 m off: no hull handed');
    c.raycastHit([x, 5, z], [0, -1, 0], 20);
  }
  assert.equal(counted.n, 0, 'and no pose read for any of them');
  const s = fleet[4], R = s.R ?? [1, 0, 0, 0, 1, 0, 0, 0, 1], m = s.at;
  const mid = [0, 1, 2].map((i) => s.T[i] + R[i] * m[0] + R[3 + i] * m[1] + R[6 + i] * m[2]);   // her bake's middle where she stands (R b + T)
  const handed = movers(c._near(mid[0] - 1, mid[0] + 1, mid[2] - 1, mid[2] + 1, [])).map((b) => b.key);
  assert.ok(handed.includes(s.key), `a query at her middle is handed her (${handed})`);
  const middleOf = (o) => { const Ro = o.R ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]; return [0, 1, 2].map((i) => o.T[i] + Ro[i] * o.at[0] + Ro[3 + i] * o.at[1] + Ro[6 + i] * o.at[2]); };
  const apart = fleet.filter((o) => Math.hypot(middleOf(o)[0] - mid[0], middleOf(o)[2] - mid[2]) > 40);
  assert.ok(apart.length >= 3, 'hulls of the fleet stand apart from her');
  for (const o of apart) assert.ok(!handed.includes(o.key), `${o.key}, 40 m and more off, is not handed (within the fleet's own box)`);
  // carried 300 m off and not told: her box kept where it was made - then told, and met where she stands
  s.T[0] += 300;
  const there = [mid[0] + 300, 30, mid[2]];
  assert.notEqual(c.raycastHit(there, [0, -1, 0], 60).key, s.key, 'her box is kept until her host says she moved');
  c.posesMoved();
  assert.equal(c.raycastHit(there, [0, -1, 0], 60).key, s.key, 'told: her deck met where she stands now');
  // her boxes made for this move, then a yard rigged out 30 m past her side, and a new hull laid: both met where they
  // stand at once - a bucket grown or laid makes the posed boxes again
  c._near(-1, 1, -1, 1, []);
  const yardAt = [m[0] + 30, 20, m[2]];   // in her bake's frame, her T carrying it
  c.addMesh(s.key, ...quads([[[m[0], 20, m[2] - 2], [m[0] + 34, 20, m[2] - 2], [m[0] + 34, 20, m[2] + 2], [m[0], 20, m[2] + 2]]]), I, () => s.T, () => s.R, true);
  const yard = [0, 1, 2].map((i) => s.T[i] + R[i] * yardAt[0] + R[3 + i] * yardAt[1] + R[6 + i] * yardAt[2]);
  assert.equal(c.raycastHit([yard[0], 40, yard[2]], [0, -1, 0], 60).key, s.key, 'her yard met where it was rigged');
  const late = { T: [500, 0, 500], R: null };
  c.addMesh('boat:late', ...hull([0, 0, 0]), I, () => late.T, () => late.R, true);
  assert.equal(c.raycastHit([500, 30, 500], [0, -1, 0], 60).key, 'boat:late', 'a hull laid after the move met where she lies');
});

test('SEA-DROPS: the world host lays every boat\'s bucket posed and says they moved after each sync carries them - in the sync\'s own body, after its last bucket is carried, baked or let go (mutants: laid unposed; never said)', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  const at = w.indexOf('  function csaSyncColliders() {');
  const body = w.slice(at, w.indexOf('\n  }\n', at) + 5);
  assert.ok(body.includes('col.addMesh(key, tri.positions, tri.indices, m, () => b.T, () => b.R, true);'), 'laid posed');
  assert.match(body, /for \(const \[key, b\] of _csaBuckets\) if \(!want\.has\(key\)\) \{ b\.col\?\.removeBucket\?\.\(key\); _csaBuckets\.delete\(key\); \}\n {4}col\?\.posesMoved\?\.\(\);[^\n]*\n {2}\}\n$/, 'told they moved, last');
  assert.equal(body.split('posesMoved?.()').length - 1, 1, 'once a sync');
  assert.equal(w.split('() => b.T, () => b.R').length - 1, 1, 'the sync is the one place a boat\'s bucket is laid');
});
