// URBANIZER U3 (2026-10-26; bible/03-World/Urban-Fabric.md section 5): a town's fabric made - its main streets' setts
// between their kerbs, its pavements of flags over them, a city's cobbles, its yards' fences (Daggerfall's own, stretched
// along each run) or low walls with their gate pillars, its dead ends' walls and its woodpiles - one model, a submesh a
// picture, its own faces at vanilla's texel density.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cellRects, runSegment, pieceAlong, townFabricModel, FABRIC_PIECES, FABRIC_ROAD_Y, FABRIC_PAVE_Y, FABRIC_LAND_Y, FABRIC_WALL, FABRIC_DEAD_WALL, FABRIC_PILE } from '../../../src/world/urban/townFabricModel.js';
import { FABRIC_KIND as K, edgeRuns } from '../../../src/world/urban/townFabric.js';
import { URBAN_ARCHIVE, URBAN_STYLE_KEYS, URBAN_KINDS, URBAN_ART } from '../../../src/world/urban/urbanRecords.js';
import { MeshBuilder } from '../../../src/world/detStandIns.js';

const C = 1.6;

test('URBANIZER U3 the rectangles: a mask laid greedily - every marked cell in exactly one rectangle, none unmarked (mutants: a row\'s run unended; a rectangle grown over a gap)', () => {
  const W = 7, H = 5, mask = new Uint8Array(W * H);
  for (const i of [0, 1, 2, 7, 8, 9, 5, 12, 19, 26, 33, 15, 16, 22]) mask[i] = 1;
  const seen = new Uint8Array(W * H);
  for (const [x0, z0, x1, z1] of cellRects(W, H, mask)) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) { assert.equal(mask[z * W + x], 1); seen[z * W + x]++; }
  assert.deepEqual([...seen], [...mask]);
  assert.deepEqual(cellRects(W, H, mask)[0], [0, 0, 3, 2], 'the first grown down');
});

test('URBANIZER U3 a run\'s segment: its line\'s ends in metres, the way out and its length, for each of the four steps (mutants: a step\'s line on the wrong side)', () => {
  const W = 10, e = (x, z, dir) => ({ inner: z * W + x, outer: -1, dir });
  const near = (got, want) => {
    for (const k of ['a', 'b', 'out']) for (let i = 0; i < 2; i++) assert.ok(Math.abs(got[k][i] - want[k][i]) < 1e-9, `${k}: ${got[k]} for ${want[k]}`);
    assert.ok(Math.abs(got.length - want.length) < 1e-9);
  };
  near(runSegment([e(2, 3, 0), e(2, 4, 0)], W), { a: [3 * C, 3 * C], b: [3 * C, 5 * C], out: [1, 0], length: 2 * C });
  near(runSegment([e(2, 3, 1)], W), { a: [2 * C, 3 * C], b: [2 * C, 4 * C], out: [-1, 0], length: C });
  near(runSegment([e(2, 3, 2), e(3, 3, 2)], W), { a: [2 * C, 4 * C], b: [4 * C, 4 * C], out: [0, 1], length: 2 * C });
  near(runSegment([e(2, 3, 3)], W), { a: [2 * C, 3 * C], b: [3 * C, 3 * C], out: [0, -1], length: C });
});

/** A piece of Daggerfall's of our own: a slab 3 m along its z, 1.5 m high, 0.25 thick, its foot at y 0.5. */
function slab() {
  const mb = new MeshBuilder();
  mb.box([67, 11], [0.125, 1.25, 1.5], [0.25, 1.5, 3]);
  return mb.build();
}
const bounds = (m) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], m.positions[i + a]); hi[a] = Math.max(hi[a], m.positions[i + a]); } return [lo, hi]; };
const wound = (m) => {
  for (let t = 0; t < m.indices.length; t += 3) {
    const P = (k) => [0, 1, 2].map((a) => m.positions[m.indices[t + k] * 3 + a]);
    const [a, b, c] = [P(0), P(1), P(2)], n = [0, 1, 2].map((a2) => m.normals[m.indices[t] * 3 + a2]);
    const u = b.map((v, i) => v - a[i]), v = c.map((w, i) => w - a[i]);
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...cr) > 1e-9) assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0, 'wound along its normal');
  }
};

test('URBANIZER U3 a Daggerfall piece along a run: its longer axis laid along the run and stretched to its length, its foot on the ground, its middle on the run, its normals unit and every face still wound along its normal - either way round (mutants: the stretch unread; the foot unlifted; a turn that mirrors left unwound)', () => {
  for (const dir of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const m = pieceAlong(slab(), [10, 20], dir, 4.8), [lo, hi] = bounds(m);
    assert.ok(Math.abs(lo[1]) < 1e-6, 'its foot on the ground');
    assert.ok(Math.abs(hi[1] - 1.5) < 1e-6);
    const along = Math.abs(dir[0]) ? hi[0] - lo[0] : hi[2] - lo[2], across = Math.abs(dir[0]) ? hi[2] - lo[2] : hi[0] - lo[0];
    assert.ok(Math.abs(along - 4.8) < 1e-5, `stretched along ${dir}`);
    assert.ok(Math.abs(across - 0.25) < 1e-5, 'its thickness kept');
    assert.ok(Math.abs((lo[0] + hi[0]) / 2 - 10) < 1e-5 && Math.abs((lo[2] + hi[2]) / 2 - 20) < 1e-5, 'its middle on the run');
    for (let i = 0; i < m.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]) - 1) < 1e-5);
    wound(m);
  }
});

/** A plan of our own: a 12 x 8 grid - a main street along rows 3-4, a pavement row either side, a yard north-east with a fence
 *  round it and a gate, a dead end's wall, a woodpile against the yard's fence. */
function plan() {
  const W = 12, H = 8, kind = new Uint8Array(W * H).fill(K.open);
  for (let x = 0; x < W; x++) { kind[2 * W + x] = K.pave; kind[3 * W + x] = K.main; kind[4 * W + x] = K.main; kind[5 * W + x] = K.pave; }
  for (let x = 0; x < W; x++) kind[0 * W + x] = K.built;
  const yard = [];
  for (let z = 6; z < 8; z++) for (let x = 6; x < 12; x++) { kind[z * W + x] = K.yard; yard.push(z * W + x); }
  kind[1 * W + 3] = K.side;
  const fences = [], gates = [];
  for (let x = 6; x < 12; x++) (x === 8 || x === 9 ? gates : fences).push({ inner: 6 * W + x, outer: 5 * W + x, dir: 3 });
  for (let z = 6; z < 8; z++) fences.push({ inner: z * W + 6, outer: z * W + 5, dir: 1 });
  const walls = [{ inner: 1 * W + 0, outer: 1 * W - 1, dir: 1 }];
  // PIN MOVED (AUDIT PROP-GROUND): `under` as planSteps mints it - no prop here, none laid
  return { W, H, kind, under: new Uint8Array(W * H), fences, gates, walls, dead: [[1 * W]], props: [{ kind: 'woodpile', cell: 6 * W + 11, dir: 3 }], shut: new Uint8Array(W * H), paths: [], ends: [], centre: -1, counts: {} };
}
const faces = (m, archive, record) => {
  const sm = m.subMeshes.find((s) => s.textureArchive === archive && s.textureRecord === record);
  if (!sm) return [];
  const out = [];
  for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) out.push([0, 1, 2].map((k) => [0, 1, 2].map((a) => m.positions[m.indices[t + k] * 3 + a])));
  return out;
};
const area = (tri) => { const [a, b, c] = tri, u = b.map((v, i) => v - a[i]), v = c.map((w, i) => w - a[i]); return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; };

test('URBANIZER U3 the model\'s streets: setts over every main cell at FABRIC_ROAD_Y, flags over every pavement at FABRIC_PAVE_Y, a kerb\'s face along every pavement edge but a house\'s, a city\'s cobbles and a hamlet\'s none, the planks\' styles no setts; a kerb under the step a town\'s walker looks ahead at (mutants: the pavement at the road\'s height; a kerb against a house; cobbles in a hamlet; the kerb over the step)', () => {
  const p = plan(), k = URBAN_STYLE_KEYS.indexOf('granite') * 8;
  const fenced = { classicModel: (id) => (id === FABRIC_PIECES.fence ? slab() : null) };
  const m = townFabricModel(p, 'granite', { cobbles: true, ...fenced });
  const setts = faces(m, URBAN_ARCHIVE, k + URBAN_KINDS.setts), flags = faces(m, URBAN_ARCHIVE, k + URBAN_KINDS.flags), cobbles = faces(m, URBAN_ARCHIVE, k + URBAN_KINDS.cobbles);
  const sum = (list) => list.reduce((s, t) => s + area(t), 0);
  assert.ok(Math.abs(sum(setts) - 24 * C * C) < 1e-3, 'every main cell');
  assert.ok(setts.every((t) => t.every((v) => Math.abs(v[1] - FABRIC_ROAD_Y) < 1e-6)));
  const tops = flags.filter((t) => t.every((v) => Math.abs(v[1] - FABRIC_PAVE_Y) < 1e-6)), sides = flags.filter((t) => !t.every((v) => Math.abs(v[1] - FABRIC_PAVE_Y) < 1e-6));
  assert.ok(Math.abs(sum(tops) - 24 * C * C) < 1e-3, 'every pavement cell');
  // kerbs: the south pavement's north edge onto the road and its south edge onto the open ground, the north pavement's south
  // edge onto the road and its north edge onto the yard's fence row and the open ground (12 cells each), and the grid's two
  // ends (four cells) - never the north pavement's... the houses stand on row 0, not beside a pavement. PIN MOVED (AUDIT
  // PROP-GROUND): a kerb runs down to the face laid past it (the setts, the cobbled side street - 25) or to the land (27)
  const kerbArea = sum(sides), kerb = (road, land) => C * (road * (FABRIC_PAVE_Y - FABRIC_ROAD_Y) + land * (FABRIC_PAVE_Y - FABRIC_LAND_Y));
  assert.ok(Math.abs(kerbArea - kerb(25, 27)) < 1e-3, `the kerbs' faces (${kerbArea.toFixed(3)})`);
  assert.ok(sides.every((t) => t.every((v) => [FABRIC_ROAD_Y, FABRIC_PAVE_Y, FABRIC_LAND_Y].some((y) => Math.abs(v[1] - y) < 1e-6))), 'each from a face or the land');
  assert.ok(Math.abs(sum(cobbles) - C * C) < 1e-3, 'a city\'s side street cobbled');
  assert.equal(faces(townFabricModel(p, 'granite', { cobbles: false }), URBAN_ARCHIVE, k + URBAN_KINDS.cobbles).length, 0, 'a hamlet\'s not');
  const kp = URBAN_STYLE_KEYS.indexOf('planks') * 8;
  assert.equal(faces(townFabricModel(p, 'planks', { cobbles: true }), URBAN_ARCHIVE, kp + URBAN_KINDS.setts).length, 0, 'the planks\' styles lay no carriageway');
  // a pavement beside a house: no kerb there
  const q = plan();
  q.kind[1 * q.W + 5] = K.pave; q.kind[1 * q.W + 3] = K.open;
  const mq = townFabricModel(q, 'granite', fenced);
  const kerbsQ = faces(mq, URBAN_ARCHIVE, k + URBAN_KINDS.flags).filter((t) => !t.every((v) => Math.abs(v[1] - FABRIC_PAVE_Y) < 1e-6));
  assert.ok(Math.abs(sum(kerbsQ) - kerb(24, 29)) < 1e-3, 'the new cell\'s two open sides, not its side on the house - and the pavement it joins loses the kerb it had onto it (a hamlet\'s side street unlaid: to the land)');
  // a walker's step is clear where its ray at its foot plus 0.1 m meets nothing (characters/mobile/mobilePerson.js _clear,
  // its feet on the town's ground - the setts' face): a kerb at or over that would shut every pavement to the town's people
  const step = Number(/const ty = this\.groundY\(x, z\) \+ ([\d.]+);/.exec(readFileSync(new URL('../../../src/characters/mobile/mobilePerson.js', import.meta.url), 'utf8'))?.[1]);
  assert.ok(step > 0 && FABRIC_PAVE_Y - FABRIC_ROAD_Y < step - 0.01, `the kerb (${FABRIC_PAVE_Y - FABRIC_ROAD_Y} m) under the walker's step (${step} m)`);
});

test('URBANIZER U3 the model\'s yards: a fenced style\'s runs in Daggerfall\'s own fence (ARCH3D 41206) a piece every 3.2 m or so, stretched along the run, the gate left open; a walled style\'s in its wall FABRIC_WALL high under a coping, a pillar either side of each gate; a dead end\'s wall FABRIC_DEAD_WALL high; the woodpile against its fence (mutants: the gate fenced; the pillars unlaid; the dead end\'s wall a yard\'s)', () => {
  const p = plan(), fence = slab();
  const asked = [];
  const m = townFabricModel(p, 'granite', { classicModel: (id) => { asked.push(id); return id === FABRIC_PIECES.fence ? fence : null; } });
  assert.ok(asked.includes(41206));
  const fenceFaces = faces(m, 67, 11);
  // the runs: the south fence (x 6-7 and 10-11 - the gate between) and the west side: 2 + 2 + 2 cells, a piece each
  const runs = edgeRuns(p, p.fences);
  assert.equal(runs.length, 3);
  assert.equal(fenceFaces.length, runs.length * 12, 'a piece a run (each 3.2 m)');
  const gateX = [8 * C, 10 * C];
  for (const t of fenceFaces) for (const v of t) if (Math.abs(v[2] - 6 * C) < 0.3) assert.ok(v[0] <= gateX[0] + 1e-6 || v[0] >= gateX[1] - 1e-6, 'the gate open');
  // walled
  const kw = URBAN_STYLE_KEYS.indexOf('imperial') * 8;
  const w = townFabricModel(p, 'imperial');
  const wall = faces(w, URBAN_ARCHIVE, kw + URBAN_KINDS.wall);
  const tops = (lo, hi) => wall.filter((t) => t.every((v) => Math.abs(v[1] - lo) < 1e-6) || t.every((v) => Math.abs(v[1] - hi) < 1e-6));
  const ys = new Set(wall.flatMap((t) => t.map((v) => +v[1].toFixed(3))));
  assert.ok(ys.has(FABRIC_WALL.h) && ys.has(FABRIC_WALL.pillarH) && ys.has(FABRIC_DEAD_WALL.h), [...ys].join(' '));
  assert.ok(tops(0, FABRIC_WALL.pillarH).length > 0);
  const coping = faces(w, URBAN_ARCHIVE, kw + URBAN_KINDS.flags).filter((t) => t.some((v) => Math.abs(v[1] - (FABRIC_WALL.h + FABRIC_WALL.copingH)) < 1e-6));
  assert.ok(coping.length > 0, 'its coping');
  // pillars: at the gate's two ends, x 8 and 10 on z 6
  const pillar = (x) => wall.some((t) => t.every((v) => Math.abs(v[0] - x) <= FABRIC_WALL.pillar / 2 + 1e-6 && v[1] <= FABRIC_WALL.pillarH + 1e-6) && t.some((v) => Math.abs(v[1] - FABRIC_WALL.pillarH) < 1e-6));
  assert.ok(pillar(8 * C) && pillar(10 * C), 'a pillar either side of the gate');
  // the woodpile: log ends to the yard and against the fence, FABRIC_PILE high
  const ends = faces(w, URBAN_ARCHIVE, URBAN_ART.logEnds);
  assert.equal(ends.length, 4, 'its two faces');
  for (const t of ends) for (const v of t) { assert.ok(v[2] >= 6 * C - 1e-6 && v[2] <= 7 * C, 'in its cell, against the fence'); assert.ok(v[1] <= FABRIC_PILE.h + 1e-6); }
});

test('URBANIZER U3 the model is one submesh a picture, its own faces at vanilla\'s texel density (world/capitalModels.js vanillaTexels: a picture every 1.6 m) and Daggerfall\'s pieces with their own (mutants: the texels unmapped)', () => {
  const p = plan(), m = townFabricModel(p, 'granite', { cobbles: true, classicModel: (id) => (id === FABRIC_PIECES.fence ? slab() : null) });
  const keys = m.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(m.subMeshes.reduce((n, s) => n + s.primitiveCount * 3, 0), m.indices.length);
  const k = URBAN_STYLE_KEYS.indexOf('granite') * 8, sm = m.subMeshes.find((s) => s.textureArchive === URBAN_ARCHIVE && s.textureRecord === k);
  const i0 = m.indices[sm.startIndex], i1 = m.indices[sm.startIndex + 1];
  const dm = Math.hypot(m.positions[i1 * 3] - m.positions[i0 * 3], m.positions[i1 * 3 + 2] - m.positions[i0 * 3 + 2]);
  const du = Math.hypot(m.uvs[i1 * 2] - m.uvs[i0 * 2], m.uvs[i1 * 2 + 1] - m.uvs[i0 * 2 + 1]);
  assert.ok(Math.abs(du / dm - 1 / 1.6) < 1e-4, `a picture every 1.6 m (${(dm / du).toFixed(3)})`);
});
