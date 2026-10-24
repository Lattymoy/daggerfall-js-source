// JUNGLE-ROADSIDE (2026-10-23, the owner, through Mac, with pine.obj, pine-1.obj and pine2.obj: "These trees are meant
// for the jungle biome and roadside. Making it more like a jungle with the vines stringing across the roads", "sunk into
// the ground so they dont float") - bible/03-World/Bantha-Jungle.md, The roadside pairs; its audit
// bible/01-Overview/audits/Audit-Jungle-Roadside.md. The owner's three pairs read off the files the game reads and cut in
// two halves, their measures held to them; the jungle's door carrying each half as a near-only prototype; the near set
// turning each across its road; the law that stands them astride the roads - sunk to the lowest drawn ground under their
// feet, their feet off every band, the road kept under their lianas - on ground made for it; the layout handing them
// beside its flats and keeping its storeys off them; the build standing each pair whole, a tree's half at its own root,
// never Logging's; the wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  JUNGLE_SPECIES, JUNGLE_ARCHIVE, jungleFiles, jungleRecord, readJungleSpecies, packJungleTrees, readJungleTrees, jungleMesh, parseObj,
} from '../../src/world/jungle/jungleModels.js';
import {
  JUNGLE_PAIRS, JUNGLE_PAIR_MEASURES, JUNGLE_ROADSIDE, EDGE_MIN, PAIR_MEASURE_STEP, UNDER_TOP, pairFiles, pairRecord, readPair,
  measurePair, turnXZ, standPairs, lowestDrawn, highestDrawn,
} from '../../src/world/jungle/jungleRoadside.js';
import { JUNGLE, withJungle, jungleLayout, pairTile } from '../../src/world/terrain/jungleNature.js';
import { groundAt } from '../../src/world/terrain/terrainNature.js';
import { surfaceHeightAt } from '../../src/world/terrain/terrainSurface.js';
import { trailClear } from '../../src/world/jungle/jungleTrails.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_BEACH_ELEVATION, TERRAIN_SIZE as PIXEL_M } from '../../src/world/terrain/terrainSampler.js';
import { MAP_W, MAP_H } from '../../src/world/road/roadNetwork.js';
import * as pathData from '../../src/world/road/pathData.js';
import * as travelPaths from '../../src/systems/travel/travelPaths.js';
import { N, S, NE, SW, NW, SE } from '../../src/world/road/pathData.js';
import * as roadVerge from '../../src/world/road/roadVerge.js';
import { roadRoom, PATH_HALF_M, ARMS } from '../../src/world/road/roadBand.js';
import { PATH_HALF_WIDTH, UNITS_PER_METRE } from '../../src/world/road/roadClearance.js';
import { buildTreeSet, lptVariety, lptCuts } from '../../src/world/lowPolyTrees.js';
import { createJungleTrees, JUNGLE_URLS } from '../../src/systems/jungleTreesAssets.js';
import { keptPairs, standRoadside } from '../../src/scenes/roadsidePairs.js';
import { Renderer } from '../../src/render/renderer.js';
import { recordingGl } from '../wispShade.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const SRC = 'src/assets/jungle/source';
const text = (p) => readFileSync(join(ROOT, p), 'utf8');
const pics = new Map();
const picture = (name) => {
  if (!pics.has(name)) { const p = PNG.sync.read(readFileSync(join(ROOT, SRC, name))); pics.set(name, { width: p.width, height: p.height, data: new Uint8Array(p.data) }); }
  return pics.get(name);
};
const sources = () => JUNGLE_SPECIES.map((s) => { const f = jungleFiles(s); return { obj: text(`${SRC}/${f.obj}`), mtl: text(`${SRC}/${f.mtl}`) }; });
const SPECIES = readJungleSpecies(sources());
const LOW = SPECIES.meshes.map((m) => m.min[1]);
const readOf = (p) => { const f = pairFiles(p); return readPair(text(`${SRC}/${f.obj}`), text(`${SRC}/${f.mtl}`), p, SPECIES.pictures, LOW); };
const READ = JUNGLE_PAIRS.map(readOf);
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const fx = (v, d) => Number(v.toFixed(d)) + 0;   // + 0: a -0 is a 0
const up = (v) => Math.ceil(v * 100 - 1e-9) / 100 + 0, down = (v) => Math.floor(v * 100 + 1e-9) / 100 + 0;
/** A mesh's triangles, each its three corners' places (nine numbers) moved by (dx, dz). */
const triangles = (mesh, dx = 0, dz = 0) => {
  const v = mesh.vertices, out = [];
  for (let i = 0; i < mesh.indices.length; i += 3) out.push([0, 1, 2].flatMap((c) => { const k = mesh.indices[i + c] * 8; return [v[k] + dx, v[k + 1], v[k + 2] + dz]; }));
  return out;
};
/** Whether `parts` are `whole`'s triangles, each once, to a tenth of a millimetre. */
const sameTriangles = (parts, whole) => {
  if (parts.length !== whole.length) return false;
  const used = new Uint8Array(whole.length);
  return parts.every((t) => {
    const i = whole.findIndex((w, k) => !used[k] && w.every((c, n) => Math.abs(c - t[n]) < 1e-4));
    if (i < 0) return false;
    used[i] = 1;
    return true;
  });
};

test('JUNGLE-ROADSIDE the owner\'s pairs, read: three of the jungle\'s own trees in pairs - the mahogany and a leaning kapok, a fig, a sunk kapok - each read whole about the middle of its two roots, a run of faces a picture, every picture a tree\'s of the jungle; a root the middle of what its tree sinks below the owner\'s ground, so the lianas never pull it; and cut in two HALVES, every face in one, each about its own tree\'s root (mutants: the root by the lowest band; the anchor off the roots\' middle; the sink read upside down; a face in both halves; a half about the anchor)', () => {
  assert.deepEqual(JUNGLE_PAIRS.map((p) => [p.key, p.file, [...p.trees]]), [['leaning', 'pine', [4, 1]], ['fig', 'pine-1', [4, 2]], ['sunk', 'pine2', [4, 1]]]);
  assert.deepEqual(READ.map((r) => r.mesh.subs.map((s) => s.picture)), [
    ['jungle_tree2_252w.png', 'jungle_tree3_252w.png', 'jungle_tree5_252w.png'],
    ['jungle_tree3_252w.png', 'jungle_tree5_252w.png'],
    ['jungle_tree2_252w.png', 'jungle_tree3_252w.png', 'jungle_tree5_252w.png'],
  ], 'a run a picture, in the order the file first names them - the lianas the fig\'s');
  // the mahogany stands in every pair as the owner's own mahogany moved 19 m along z (its every vertex so): its root is
  // its species' root moved with it, so the rule reads the tree the owner drew
  const mahogany = jungleMesh(parseObj(text(`${SRC}/jungle_tree5.obj`)));
  READ.forEach((r, k) => {
    const [rx, rz] = r.roots[0], ownX = r.anchor[0] - rx, ownZ = r.anchor[1] + rz;   // back into the owner's scene (the mirror undone)
    assert.ok(near(ownX, mahogany.root[0], 1e-5) && near(ownZ, mahogany.root[1] - 19, 1e-5), `${JUNGLE_PAIRS[k].key}: the mahogany's root, moved as the owner moved it`);
    assert.ok(near(r.roots[0][0] + r.roots[1][0], 0, 1e-9) && near(r.roots[0][1] + r.roots[1][1], 0, 1e-9), 'the anchor the middle of the two roots');
    let n = 0;
    for (const s of r.mesh.subs) { assert.equal(s.at, n); n += s.count; }
    assert.equal(n, r.mesh.indices.length, 'every face in one run');
    // THE HALVES: every face of the whole in one of them, and each half the whole's own about its tree's root - so a
    // half instanced at its root draws what the whole at the anchor drew
    assert.equal(r.halves[0].indices.length + r.halves[1].indices.length, r.mesh.indices.length, 'every face in one half');
    assert.ok(sameTriangles([...triangles(r.halves[0], r.roots[0][0], r.roots[0][1]), ...triangles(r.halves[1], r.roots[1][0], r.roots[1][1])], triangles(r.mesh)), 'each half the whole\'s, about its root');
    assert.ok(r.halves.every((h) => h.vertices.length / 8 < 65535));
  });
  // each tree in its own half: the mahogany's picture in the first alone, its partner's in the second
  assert.deepEqual(READ.map((r) => r.halves.map((h) => h.subs.map((s) => s.picture.slice(0, 12)))), [
    [['jungle_tree3', 'jungle_tree5'], ['jungle_tree2', 'jungle_tree3']],
    [['jungle_tree3', 'jungle_tree5'], ['jungle_tree3']],
    [['jungle_tree3', 'jungle_tree5'], ['jungle_tree2', 'jungle_tree3']],
  ], 'each tree in its own half, the lianas shared out');
  assert.deepEqual(READ.map((r) => r.base.map((v) => fx(v, 2))), [[0, 0.21], [0, 0], [0, -2]], 'the sunk kapok 2 m under its own file; the leaning kapok\'s mound 0.21 m over it');
  // the fig's lianas hang to 0.66 m over the ground beside its trunk: a lowest-band root (jungleMesh's) is pulled toward
  // the road by them; the sunk-below-ground root is not
  const fig = READ[1], P = parseObj(text(`${SRC}/pine-1.obj`));
  const banded = jungleMesh({ ...P, faces: P.faces.filter((f) => f.material === 'Material.007') });
  const figOwn = [fig.anchor[0] - fig.roots[1][0], fig.anchor[1] + fig.roots[1][1]];
  assert.ok(Math.hypot(banded.root[0] - figOwn[0], banded.root[1] - figOwn[1]) > 2, 'the band\'s root is pulled off the trunk');
  assert.throws(() => readPair(text(`${SRC}/pine2.obj`), text(`${SRC}/pine2.mtl`), { trees: [4, 2] }, SPECIES.pictures, LOW), /no tree of jungle_tree3_252w\.png stands into its ground/, 'a picture only lianas wear is no tree');
});

test('JUNGLE-ROADSIDE each pair as it stands, measured off what it draws at a converged step: its roots, each tree\'s base and foot, its height, and what hangs over its road - its lowest, how far along the road any of it stands, and the lowest in each half-metre cell - the table the terrain worker reads, held to the files (mutants: a root drifted; a foot drifted; a base dropped; the over-road low read across the whole gap; the cells unkept; a coarse step)', () => {
  assert.equal(PAIR_MEASURE_STEP, 0.02);
  READ.forEach((r, k) => {
    const m = measurePair(r, picture), t = JUNGLE_PAIR_MEASURES[k], key = JUNGLE_PAIRS[k].key;
    assert.deepEqual(r.roots.map((q) => q.map((v) => fx(v, 3))), t.roots.map((q) => [...q]), `${key}: its roots`);
    assert.deepEqual({ base: r.base.map((v) => fx(v, 2)), feet: m.feet.map(up), height: fx(m.height, 2), over: down(m.over), reach: up(m.reach) },
      { base: [...t.base], feet: [...t.feet], height: t.height, over: t.over, reach: t.reach }, key);
    assert.deepEqual(m.under.map(([x, z, y]) => [fx(x, 2), fx(z, 2), down(y)]), t.under.map((c) => [...c]), `${key}: its cells`);
    assert.ok(t.under.every((c) => c[2] >= t.over && c[2] < UNDER_TOP), 'every cell between its lowest and UNDER_TOP');
    // converged (AUDIT JUNGLE-ROADSIDE LAW-3: at 0.1 m the grid stepped over a liana's tip and a root's reach)
    const coarse = measurePair(r, picture, 0.05);
    assert.ok(coarse.feet.every((f, i) => near(f, m.feet[i], 0.02)) && near(coarse.over, m.over, 0.01), `${key}: 0.05 m agrees with ${PAIR_MEASURE_STEP} m`);
  });
  // the road's band fits between the two feet at the smallest scale with room to spare, and the lianas over a level
  // road keep their headroom over it
  for (const [k, t] of JUNGLE_PAIR_MEASURES.entries()) {
    const span = Math.hypot(t.roots[1][0] - t.roots[0][0], t.roots[1][1] - t.roots[0][1]);
    const gap = (span - t.feet[0] - t.feet[1]) * JUNGLE_ROADSIDE.scale[0];
    assert.ok(gap / 2 > PATH_HALF_M + 1.5, `${JUNGLE_PAIRS[k].key}: a road's band between its feet (${gap.toFixed(2)} m)`);
    assert.ok((t.over * JUNGLE_ROADSIDE.scale[0] - JUNGLE_ROADSIDE.sink) - JUNGLE_ROADSIDE.headroom > 0.7, 'and room under its lianas over a level road');
  }
});

test('JUNGLE-ROADSIDE the jungle\'s door carries the pairs: two near-only prototypes a pair after the five trees, a half each, keyed by its record, a run a picture each the atlas of the species wearing it, sized by its own reach - the five trees\' own prototypes and meshes untouched; a near-only prototype is a handle for the near set alone (no far picture drawn or uploaded, none given back), draws in the jungle\'s slot and keeps its atlases while held; a pair\'s files failing cost that pair alone (mutants: the pair\'s run wearing the first species\' atlas; a half\'s size halved; a near-only prototype\'s far picture drawn; its atlases unkept; its handle\'s absent texture given back; the pairs read in the five\'s load)', async () => {
  const TREES = readJungleTrees(sources());
  const halves = READ.flatMap((r, k) => r.halves.map((mesh, side) => ({ record: pairRecord(JUNGLE_PAIRS[k], side), mesh })));
  const both = packJungleTrees(SPECIES, halves);
  assert.deepEqual(both.json.meshes.slice(0, 5), TREES.json.meshes, 'the five trees\' meshes as they were');
  for (const [key, p] of TREES.protos) assert.deepEqual(both.protos.get(key), p, `${key} as it was`);
  assert.deepEqual(both.treesBin.subarray(0, TREES.json.vertexBytes), TREES.treesBin.subarray(0, TREES.json.vertexBytes), 'the five trees\' vertices first, as they were');
  JUNGLE_PAIRS.forEach((p, k) => [0, 1].forEach((side) => {
    const proto = both.protos.get(`500_jungle-pair-${p.key}.${side}`), mesh = READ[k].halves[side];
    assert.ok(proto?.nearOnly, `${p.key}.${side}`);
    assert.equal(proto.mesh, 5 + 2 * k + side);
    assert.deepEqual(proto.subs.map((s) => s.atlas), mesh.subs.map((s) => JUNGLE_SPECIES[SPECIES.pictures.indexOf(s.picture)].key));
    assert.deepEqual(both.json.meshes[5 + 2 * k + side].subs, mesh.subs.map((s) => [s.at, s.count]));
    let reach = 0, top = 0;
    for (let i = 0; i < mesh.vertices.length; i += 8) { reach = Math.max(reach, Math.abs(mesh.vertices[i]), Math.abs(mesh.vertices[i + 2])); top = Math.max(top, mesh.vertices[i + 1]); }
    assert.ok(near(proto.size.w, 2 * reach, 1e-4) && near(proto.size.h, top, 1e-4), `${p.key}.${side}: sized by its own reach (the near set culls by it)`);
  }));
  assert.throws(() => packJungleTrees(SPECIES, [{ record: 'x', mesh: { ...READ[0].mesh, subs: [{ at: 0, count: 3, picture: 'nobody.png' }] } }]), /which no tree of the jungle wears/);

  // the door over the real files
  const byUrl = new Map(Object.entries(JUNGLE_URLS).map(([name, url]) => [url, name]));
  const doorOf = ({ fail = null, warn = (m) => assert.fail(m) } = {}) => {
    const uploads = [], released = [], frames = [], { gl } = recordingGl(), clock = { t: 0 };
    const renderer = {
      gl, uploadTexture: (a, rec) => uploads.push([a, rec]), releaseTexture: (a, rec) => released.push([a, rec]), setLowPolyTrees: (f, slot) => frames.push([f, slot]),
      createAtlasTexture: (w, h, levels) => ({ w, h, levels }), uploadAtlasRows: () => {}, releaseAtlasTexture: () => {},
    };
    const door = createJungleTrees({
      renderer, breathe: async () => {}, warn, now: () => clock.t,
      fetchBytes: async (url) => { const name = byUrl.get(url); if (name === fail) throw new Error(`${name}: 503`); return new Uint8Array(readFileSync(join(ROOT, SRC, name))); },
      decode: async (bytes) => { const p = PNG.sync.read(Buffer.from(bytes)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; },
    });
    return { door, uploads, released, frames, clock };
  };
  const { door, uploads, released, frames, clock } = doorOf();
  await door.load();
  const proto = door.pairProto(2, 1);
  assert.equal(proto.key, '500_jungle-pair-sunk.1');
  const h = await door.farPicture(proto);
  assert.deepEqual([h.proto, h.record, h.size], [proto, null, null], 'a handle, no far picture');
  assert.deepEqual(uploads, [], 'nothing uploaded');
  door.acquire(h);
  const set = { ox: 0, oy: 0, oz: 0, handles: [h], ...buildTreeSet(400, 100, [{ h: 0, centers: [[0, 0, 5]], wild: null, own: Float32Array.of(1), turn: Float32Array.of(0.5) }]) };
  door.frame([set], 0, 0, 0, { stamp: 1 });
  let [f, slot] = frames.at(-1);
  assert.equal(slot, 1, 'the jungle\'s slot');
  assert.ok(f.cut.has(h) && f.runs[0].drawCount === 1 && f.runs[0].subs.length === 2 && f.runs[0].subs.every((s) => s.tex), 'drawn near, a run a picture');
  // held past LPT_IDLE_S, unseen: its atlases are its own to keep - it draws whole when it is seen again
  clock.t = 31_000; door.frame([], 0, 0, 0, { stamp: 2 });
  clock.t = 62_000; door.frame([set], 0, 0, 0, { stamp: 3 });
  [f] = frames.at(-1);
  assert.ok(f.cut.has(h) && f.runs[0].subs.every((s) => s.tex), 'its atlases kept while it is held');
  door.release(h);
  door.frame([], 0, 0, 0, { stamp: 4 });
  clock.t = 93_000; door.frame([], 0, 0, 0, { stamp: 5 });   // past LPT_IDLE_S unheld: given back
  assert.equal(door._handles.size, 0, 'given back');
  assert.deepEqual(released, [], 'no texture of its own to give back');

  // one of a pair's files failing costs that pair alone - the five trees and the other pairs stand (AUDIT
  // JUNGLE-ROADSIDE GAME-3/READ-2: it failed the whole door)
  const warned = [], was = console.warn;
  const lost = doorOf({ fail: 'pine2.mtl' });
  console.warn = (m) => warned.push(m);
  try { assert.ok(await lost.door.load(), 'the door loads'); } finally { console.warn = was; }
  assert.ok(JUNGLE_SPECIES.every((s, k) => lost.door.proto(k)?.key === `${JUNGLE_ARCHIVE}_${jungleRecord(s)}`), 'the five trees stand');
  assert.deepEqual([0, 1, 2].map((k) => lost.door.pairProto(k, 0) != null), [true, true, false], 'the sunk pair alone gone');
  assert.equal(warned.length, 1);
  assert.match(warned[0], /the roadside pair pine2 will not read: pine2\.mtl: 503/);
  // each pair read a breath of its own, after the five (AUDIT JUNGLE-ROADSIDE PERF-3)
  assert.match(text('src/systems/jungleTreesAssets.js'), /for \(const \[k, p\] of JUNGLE_PAIRS\.entries\(\)\) \{\n\s+if \(breathe\) await breathe\(\);/);
  assert.match(text('src/systems/jungleTreesAssets.js'), /if \(breathe\) await breathe\(\);\n\s+trees = packJungleTrees\(species, halves\);/, 'and a breath before the pack');
});

test('JUNGLE-ROADSIDE the near set turns a half across its road: a group\'s own `turn` in place of lptVariety\'s; turnXZ is the turn the trees\' program gives a vertex (mutants: the turn ignored; turnXZ turned the other way)', () => {
  const c = [[10, 0, 20], [30, 0, 40]];
  const own = buildTreeSet(400, 100, [{ h: 0, centers: c, wild: null, own: Float32Array.of(1, 1), turn: Float32Array.of(0.25, -2) }]);
  assert.deepEqual([own.trees[5], own.trees[11]], [Math.fround(0.25), Math.fround(-2)]);
  const theirs = buildTreeSet(400, 100, [{ h: 0, centers: c, wild: null, own: Float32Array.of(1, 1) }]);
  assert.equal(theirs.trees[5], Math.fround(lptVariety(400, 100, 10, 20, true).yaw));
  assert.match(text('src/render/renderer.js'), /float tc = cos\(aInst\.w\), tsn = sin\(aInst\.w\);[\s\S]{0,120}world = vec3\(tc \* p\.x \+ tsn \* p\.z, p\.y, -tsn \* p\.x \+ tc \* p\.z\) \+ aInst\.xyz;/, 'the program\'s turn');
  const [x, z] = turnXZ(3, 4, 0.7);
  assert.ok(near(x, Math.cos(0.7) * 3 + Math.sin(0.7) * 4) && near(z, -Math.sin(0.7) * 3 + Math.cos(0.7) * 4));
});

// ---- the law on ground made for it ----------------------------------------------------------------------------------

const PX = 400, PY = 100, H = HEIGHTMAP_DIMENSION, yScale = 1923.75, CELL = PIXEL_M / (H - 1), HALF = PIXEL_M / 2;
/** A pixel's heightmap: level ground over the beach, tilted `grade` (m a metre) east, and a gentle swell. */
const ground = (grade = 0, swell = 0) => {
  const hm = new Float32Array(H * H);
  for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) hm[a * H + b] = SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT * 1.6 + (grade * a * CELL + swell * Math.sin(a / 7) * Math.cos(b / 5)) / yScale;
  return hm;
};
/** A road north-south through pixel `px` and tracks north-east and north-west out of it (a junction at its middle,
 *  where a pair by one arm reaches over another's band). */
const network = (px = PX) => {
  const net = { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) };
  const at = (x, y) => y * MAP_W + x;
  net.roads[at(px, PY)] = N | S; net.tracks[at(px, PY)] = NE | NW;
  net.roads[at(px, PY - 1)] = S; net.roads[at(px, PY + 1)] = N; net.tracks[at(px + 1, PY - 1)] = SW; net.tracks[at(px - 1, PY - 1)] = SE;
  return net;
};
const job = (hm, extra = {}) => ({ px: PX, py: PY, net: network(), heightmapData: hm, tileOk: () => true, trailOk: () => true, ...extra });
const astride = (p) => Math.abs(p.ax - HALF) < 20;   // the north-south road's (the tracks' leave the middle at 45 degrees)
/** Where the middle of the gap between a pair's feet stands - on its road's line - and its axis across the road. */
const gapOf = (p) => {
  const m = JUNGLE_PAIR_MEASURES[p.kind], [a, b] = p.trees, ux = b.x - a.x, uz = b.z - a.z, span = Math.hypot(ux, uz);
  const g = m.feet[0] * p.js + (span - (m.feet[0] + m.feet[1]) * p.js) / 2;
  return { x: a.x + (ux / span) * g, z: a.z + (uz / span) * g, ux: ux / span, uz: uz / span };
};
/** The lowest a pair's lianas hang over the drawn road under them: each `under` cell (square to the road, half a metre
 *  at the owner's size) over the ground's highest under it (a fine walk of its square). */
const clearance = (hm, p) => {
  const m = JUNGLE_PAIR_MEASURES[p.kind], q = gapOf(p), h = (0.5 * p.js) / 2;
  let lo = Infinity;
  for (const [cx, cz, cy] of m.under) {
    const [dx, dz] = turnXZ(cx * p.js, cz * p.js, p.turn), x = p.ax + dx, z = p.az + dz;
    let road = -Infinity;
    for (let i = -1; i <= 1; i += 0.25) for (let j = -1; j <= 1; j += 0.25) road = Math.max(road, surfaceHeightAt(hm, x + (i * q.ux - j * q.uz) * h, z + (i * q.uz + j * q.ux) * h));
    lo = Math.min(lo, p.y + cy * p.js - road);
  }
  return lo;
};

test('JUNGLE-ROADSIDE the law: a pair astride each road - its axis across it, the gap between its feet centred on the road\'s line, both feet off every band (the junction\'s other road\'s too), its trees where their halves draw them; a station every 40 m from 44 m out, none within 24 m of the edge, each slid up to 8 m, three in five standing; each pair one of the three, either way round, at its own scale; a hash of the world - every call the same pairs; no road, no pairs (mutants: the gap off the line; the axis along the road; the feet\'s band unasked; the stations moved; the slide dropped; the chance moved; a kind, a turn or the scale unused; the pairs\' own spacing unasked)', () => {
  const hm = ground(0, 0.6), pairs = standPairs(job(hm));
  assert.equal(pairs.length, 23, 'the fixture\'s pairs along a road and two tracks');
  assert.deepEqual(standPairs(job(hm)), pairs, 'the same pairs every time');
  const net = network();
  const sides = new Set(), offs = [];
  for (const p of pairs) {
    const m = JUNGLE_PAIR_MEASURES[p.kind];
    p.trees.forEach((t, k) => {
      const [dx, dz] = turnXZ(m.roots[k][0] * p.js, m.roots[k][1] * p.js, p.turn);
      assert.ok(near(t.x, p.ax + dx, 1e-9) && near(t.z, p.az + dz, 1e-9), 'where its half draws it');
      assert.equal(t.species, JUNGLE_PAIRS[p.kind].trees[k]);
      assert.equal(t.record, JUNGLE_SPECIES[t.species].record);
      assert.ok(roadRoom(net, PX, PY, t.x, t.z, m.feet[k] * p.js) >= m.feet[k] * p.js - 1e-9, 'its foot off every band');
    });
    const q = gapOf(p);
    const onNS = near(q.x, HALF, 1e-6), onNE = near(q.x - HALF, q.z - HALF, 1e-6) && q.x > HALF, onNW = near(HALF - q.x, q.z - HALF, 1e-6) && q.x < HALF;
    assert.ok(onNS || onNE || onNW, `the gap's middle on a road's line (${q.x.toFixed(3)}, ${q.z.toFixed(3)})`);
    const along = onNE ? [Math.SQRT1_2, Math.SQRT1_2] : onNW ? [-Math.SQRT1_2, Math.SQRT1_2] : [0, Math.sign(q.z - HALF)];
    assert.ok(near(q.ux * along[0] + q.uz * along[1], 0, 1e-9), 'its axis across its road');
    sides.add(Math.sign(q.ux * along[1] - q.uz * along[0]));   // the mahogany on its road's left or its right, going out
    const s = Math.hypot(q.x - HALF, q.z - HALF), n = Math.round((s - 44) / 40);
    offs.push(s - 44 - n * 40);
    assert.ok(n >= 0 && s <= (onNS ? HALF : HALF * Math.SQRT2) - 24 + 8 + 1e-9, 'a station from 44 m out, none within 24 m of the edge');
  }
  assert.ok(offs.every((o) => Math.abs(o) <= 8 + 1e-9) && offs.some((o) => Math.abs(o) > 6), 'each slid along its road, up to 8 m');
  assert.deepEqual([0, 1, 2].map((k) => pairs.some((p) => p.kind === k)), [true, true, true], 'all three pairs');
  assert.equal(sides.size, 2, 'either way round');
  assert.ok(pairs.every((p) => p.js >= JUNGLE_ROADSIDE.scale[0] && p.js <= JUNGLE_ROADSIDE.scale[1]) && pairs.some((p) => p.js < 0.95) && pairs.some((p) => p.js > 1.04), 'at its own scale');
  for (let i = 0; i < pairs.length; i++) for (let j = 0; j < i; j++) for (const s of pairs[i].trees) for (const t of pairs[j].trees) {
    assert.ok(Math.hypot(s.x - t.x, s.z - t.z) >= JUNGLE_ROADSIDE.clear * pairs[i].js - 1e-9, 'no pair\'s trunk within another\'s clearance');
  }
  // a star of eight roads: by its middle a pair along one reaches over the next one's band, and stands only where it
  // does not
  const star = { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) };
  star.roads[PY * MAP_W + 300] = 0xff;
  const starred = standPairs({ ...job(ground(0, 0)), px: 300, net: star });
  assert.ok(starred.length > 30);
  for (const p of starred) p.trees.forEach((t, k) => { const f = JUNGLE_PAIR_MEASURES[p.kind].feet[k] * p.js; assert.ok(roadRoom(star, 300, PY, t.x, t.z, f) >= f - 1e-9, 'a star\'s pair\'s foot off every band'); });
  assert.deepEqual(standPairs(job(hm, { net: null })), [], 'no network, no pairs');
  assert.deepEqual(standPairs(job(hm, { py: PY + 3 })), [], 'a pixel no road crosses');
});

test('JUNGLE-ROADSIDE where it asks: both trunks\' tiles of the jungle\'s tree law (pairTile - the jungle whole, a ground that grows, no slope past 34 degrees, no place\'s fields), both feet off the trails at their own reach; and by its stations alone every trunk stands EDGE_MIN inside its pixel - farther than a neighbour\'s can crowd (mutants: the first trunk\'s tile alone asked; the trails asked at a point; a term of the tile law dropped; the tile read transposed)', () => {
  const hm = ground(0, 0.6), all = standPairs(job(hm));
  // a tile under the SECOND tree of one pair refused: that pair stands no more, and the rest as they stood
  const lost = all[3], tile = (t) => [Math.floor(t.x / (PIXEL_M / 128)), Math.floor(t.z / (PIXEL_M / 128))];
  const [bx, by] = tile(lost.trees[1]);
  assert.ok(!all.some((p) => p !== lost && p.trees.some((t) => tile(t)[0] === bx && tile(t)[1] === by)), 'its tile its own');
  assert.deepEqual(standPairs(job(hm, { tileOk: (x, y) => !(x === bx && y === by) })), all.filter((p) => p !== lost));
  // the trails asked at each foot's own reach
  const asked = [];
  standPairs(job(hm, { trailOk: (x, z, r) => { asked.push(r); return true; } }));
  const feet = JUNGLE_PAIR_MEASURES.flatMap((m) => m.feet);
  assert.ok(asked.length >= 2 * all.length && asked.every((r) => feet.some((f) => r >= f * JUNGLE_ROADSIDE.scale[0] - 1e-9 && r <= f * JUNGLE_ROADSIDE.scale[1] + 1e-9)), 'a foot\'s reach');
  // THE TILE LAW, a term at a time, on tiles that are not their own transposes
  const T = 128, share = new Float32Array(T * T).fill(1), groundOf = new Float32Array(T * T).fill(1), g2 = new Float32Array(T * T), open = new Float32Array(T * T);
  const ok = pairTile(share, groundOf, g2, open);
  share[9 * T + 5] = 0.99; groundOf[9 * T + 6] = 0; g2[9 * T + 7] = Math.tan(34.5 * Math.PI / 180) ** 2; open[9 * T + 8] = 0.01;
  assert.deepEqual([5, 6, 7, 8].map((x) => ok(x, 9)), [false, false, false, false], 'the jungle whole, a ground that grows, under 34 degrees, no place\'s fields');
  assert.deepEqual([5, 6, 7, 8].map((y) => ok(9, y)), [true, true, true, true], 'each its own tile (x, y), never its transpose');
  g2[9 * T + 7] = Math.tan(33.5 * Math.PI / 180) ** 2;
  assert.ok(ok(7, 9), '33.5 degrees stands');
  assert.match(text('src/world/terrain/jungleNature.js'), /tileOk: pairTile\(share, groundOf, g2Of, openOf\),\n\s+trailOk: \(x, z, r\) => !trails \|\| trailClear\(px, py, x, z, r\),/, 'the layout\'s own law and trails');
  // EVERY STATION of every arm, slid either way, every pair, turn and the two extreme scales: a trunk EDGE_MIN inside
  let nearest = Infinity;
  for (const [, sx, sz] of ARMS) {
    const len = Math.hypot(sx, sz) * HALF, rx = sx / Math.hypot(sx, sz), rz = sz / Math.hypot(sx, sz);
    for (let s0 = JUNGLE_ROADSIDE.first; s0 <= len - JUNGLE_ROADSIDE.end; s0 += JUNGLE_ROADSIDE.step) {
      for (const slide of [-1, 1]) for (const m of JUNGLE_PAIR_MEASURES) for (const flip of [false, true]) for (const js of JUNGLE_ROADSIDE.scale) {
        const s = s0 + slide * JUNGLE_ROADSIDE.jitter, ux = flip ? rz : -rz, uz = flip ? -rx : rx, [[lax, laz], [lbx, lbz]] = m.roots;
        const turn = Math.atan2(lbz - laz, lbx - lax) - Math.atan2(uz, ux), mid = ((m.feet[0] - m.feet[1]) / 2) * js;
        for (const [x, z] of m.roots) {
          const [dx, dz] = turnXZ(x * js, z * js, turn), tx = HALF + rx * s - ux * mid + dx, tz = HALF + rz * s - uz * mid + dz;
          nearest = Math.min(nearest, tx, tz, PIXEL_M - tx, PIXEL_M - tz);
        }
      }
    }
  }
  assert.ok(nearest >= EDGE_MIN && nearest < EDGE_MIN + 1, `a trunk at least ${EDGE_MIN} m inside (${nearest.toFixed(2)})`);
  assert.ok(EDGE_MIN > JUNGLE_ROADSIDE.clear * JUNGLE_ROADSIDE.scale[1], 'farther than a neighbour pixel\'s trunk can crowd it');
});

test('JUNGLE-ROADSIDE THE DRAWN GROUND\'S LOWEST AND HIGHEST, exactly: lowestDrawn under a disc and highestDrawn over a polygon are the drawn ground\'s own (terrainSurface.js surfaceHeightAt - never the bilinear, which stands up to half a metre over it), every grid point, rim or edge crossing and the rim\'s own fall asked - never under or over what a fine walk of it finds (mutants: the bilinear ground; the rim\'s crossings unasked; the rim\'s fall unasked; the polygon\'s inside unasked; its edges\' crossings unasked)', () => {
  // a rough ground: every sample its own
  const hm = new Float32Array(H * H);
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < H * H; i++) hm[i] = (100 + rand() * 6) / yScale;
  for (const [x, z, r] of [[203.3, 411.7, 6.2], [410.1, 98.6, 9.1], [512.4, 512.4, 7.7], [33.3, 701.9, 5.9], [608.8, 300.05, 8.4]]) {
    let fine = Infinity;
    for (let dx = -r; dx <= r; dx += 0.05) for (let dz = -r; dz <= r; dz += 0.05) if (Math.hypot(dx, dz) <= r) fine = Math.min(fine, surfaceHeightAt(hm, x + dx, z + dz));
    for (let t = 0; t < 2 * Math.PI; t += 0.0005) fine = Math.min(fine, surfaceHeightAt(hm, x + r * Math.cos(t), z + r * Math.sin(t)));
    const lo = lowestDrawn(hm, x, z, r);
    assert.ok(lo <= fine + 1e-9 && lo >= fine - 0.002, `the lowest under (${x}, ${z}) r ${r}: ${lo} against the walk's ${fine}`);
  }
  // a valley down a cell's diagonal, falling along it: the lowest under a disc on it is where the valley leaves the
  // disc - a rim's crossing of the diagonal, no grid point's nor any one plane's fall
  const valley = new Float32Array(H * H);
  for (let i = 0; i < H; i++) for (let j = 0; j < H; j++) valley[i * H + j] = (100 + 0.5 * Math.abs(i - j) * CELL - 0.2 * (i + j) * CELL) / yScale;
  {
    const x = 50.3 * CELL, z = 50.3 * CELL, r = 7;
    let fine = Infinity;
    for (let t = 0; t < 2 * Math.PI; t += 0.0002) fine = Math.min(fine, surfaceHeightAt(valley, x + r * Math.cos(t), z + r * Math.sin(t)));
    const lo = lowestDrawn(valley, x, z, r), at = surfaceHeightAt(valley, x + r * Math.SQRT1_2, z + r * Math.SQRT1_2);
    assert.ok(near(lo, at, 1e-6) && lo <= fine + 1e-9, `the valley's lowest, where it leaves the disc: ${lo} (${at})`);
  }
  for (const [x, z, a, along, across] of [[300.7, 220.2, 0.4, 9.3, 6.4], [500, 600, Math.PI / 4, 3.1, 6.4], [111.1, 650.6, 1.9, 7.7, 6.4]]) {
    const ca = Math.cos(a), sa = Math.sin(a);
    const at = (i, j) => [x + ca * i * along - sa * j * across, z + sa * i * along + ca * j * across];
    let fine = -Infinity;
    for (let i = -1; i <= 1; i += 0.002) for (let j = -1; j <= 1; j += 0.004) fine = Math.max(fine, surfaceHeightAt(hm, ...at(i, j)));
    const hi = highestDrawn(hm, [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)]);
    assert.ok(hi >= fine - 1e-9 && hi <= fine + 0.01, `the highest over (${x}, ${z}): ${hi} against the walk's ${fine}`);
  }
  // a saddle: two corners of a cell raised across the diagonal its ground is cut on - the drawn ground at the cell's
  // middle is the diagonal's, 2 m under the bilinear's
  const saddle = new Float32Array(H * H).fill(100 / yScale);
  saddle[10 * H + 11] += 4 / yScale; saddle[11 * H + 10] += 4 / yScale;
  const mx = 10.5 * CELL, mz = 10.5 * CELL;
  assert.ok(near(groundAt(saddle, mx, mz), 102, 1e-3) && near(lowestDrawn(saddle, mx, mz, 0.5), 100, 1e-3), 'the drawn ground\'s, not the bilinear\'s');
  assert.match(text('src/world/jungle/jungleRoadside.js'), /const y = Math\.min\(\.\.\.trees\.map\(\(t\) => lowestDrawn\(heightmapData, t\.x, t\.z, t\.foot\)\)\) - R\.sink;/);
});

test('JUNGLE-ROADSIDE SUNK, NEVER FLOATING: a pair stands 0.3 m under the lowest drawn ground beneath either foot - nowhere under its feet is the ground within 0.3 m of it, and under one it is exactly that; a trunk buried more than 3 m stands none; the road under its lianas keeps 2.75 m under each of their cells, and 2.75 m under UNDER_TOP anywhere under the pair (mutants: the highest ground taken; the sink raised out of the ground or dropped; the burial unasked or moved; the headroom moved or unscaled; the cells over the band unasked; the road\'s highest unasked)', () => {
  for (const [grade, swell] of [[0, 0], [0, 0.8], [0.03, 0.5], [0.05, 0]]) {
    const hm = ground(grade, swell), pairs = standPairs(job(hm));
    assert.ok(pairs.length > 0, `grade ${grade}: some pairs`);
    for (const p of pairs) {
      const m = JUNGLE_PAIR_MEASURES[p.kind];
      const lows = p.trees.map((t, k) => lowestDrawn(hm, t.x, t.z, m.feet[k] * p.js) - p.y);
      assert.ok(near(Math.min(...lows), 0.3, 1e-6), `grade ${grade}: 0.3 m under the lowest under its feet (${lows.map((v) => v.toFixed(4))})`);
      p.trees.forEach((t, k) => {
        const r = m.feet[k] * p.js;
        for (let dx = -r; dx <= r; dx += 0.5) for (let dz = -r; dz <= r; dz += 0.5) {
          if (Math.hypot(dx, dz) <= r) assert.ok(surfaceHeightAt(hm, t.x + dx, t.z + dz) - p.y >= 0.3 - 1e-6, 'its sink whole under its foot');
        }
        assert.ok(surfaceHeightAt(hm, t.x, t.z) - p.y <= 3 + 1e-9, 'a trunk buried no deeper than 3 m');
        assert.ok(near(t.y, p.y + m.base[k] * p.js, 1e-9), 'each tree at the pair\'s height, its own base on it');
      });
      assert.ok(clearance(hm, p) >= 2.75 - 1e-9, 'its lianas\' headroom');
    }
  }
  assert.deepEqual(standPairs(job(ground(0.15, 0))), [], 'a 15% cross-slope stands none');
  // a hollow under a foot - one sample a metre down inside it, off its rim - sinks the pair the whole metre
  const level = ground(0, 0), was = standPairs(job(level))[0], t0 = was.trees[0];
  const hi = Math.round((t0.x + 2) / CELL), hj = Math.round(t0.z / CELL);
  assert.ok(Math.hypot(hi * CELL - t0.x, hj * CELL - t0.z) < JUNGLE_PAIR_MEASURES[was.kind].feet[0] * was.js - 1, 'inside the foot');
  const hollow = Float32Array.from(level);
  hollow[hi * H + hj] -= 1 / yScale;
  const sunk = standPairs(job(hollow)).find((p) => near(p.ax, was.ax, 1e-9) && near(p.az, was.az, 1e-9));
  assert.ok(sunk && near(sunk.y, was.y - 1, 1e-4), `the hollow sinks it (${sunk && (sunk.y - was.y).toFixed(4)})`);
  // a trunk's own ground over the lowest under the other's foot - a cliff east of the road, the road level: 2.5 m up its
  // trunk is buried 2.8 m and stands; 3.5 m up, 3.8 m, and none does
  const cliff = (c) => { const hm = ground(0, 0); for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) if (a * CELL > HALF + 11) hm[a * H + b] += c / yScale; return hm; };
  assert.equal(standPairs(job(cliff(2.5))).filter(astride).length, standPairs(job(level)).filter(astride).length, '2.5 m: every one');
  assert.deepEqual(standPairs(job(cliff(3.5))).filter(astride), [], '3.5 m: none');
  // THE ROAD UNDER ITS LIANAS: a road raised over the pair's ground - every pair that stands keeps 2.75 m under its lowest
  // cell over the band, and some keep no more than a hand's breadth over that
  const raised = (h) => { const hm = ground(0, 0); for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) if (Math.abs(a * CELL - HALF) < 8) hm[a * H + b] += h / yScale; return hm; };
  const tight = [];
  for (const h of [0, 0.5, 1, 1.5, 2, 3, 4, 5]) {
    const hm = raised(h), stood = standPairs(job(hm)).filter(astride);
    for (const p of stood) { const c = clearance(hm, p); assert.ok(c >= 2.75 - 1e-9, `${h} m up: ${c.toFixed(3)} m under its lianas`); tight.push([h, p.kind, c]); }
    if (h === 4) assert.ok(stood.length > 0 && stood.every((p) => p.kind === 1), '4 m up, the figs alone');
    if (h === 5) assert.deepEqual(stood, [], '5 m up, none');
  }
  assert.ok(tight.some(([h, k, c]) => h === 4 && k === 1 && c < 2.85) && tight.some(([h, k, c]) => h === 1 && k !== 1 && c < 2.85), 'as near as the law lets it');
  // a road climbing along itself, at grades a few thousandths apart: each cell's road read at its HIGHEST (a cell is
  // half a metre - its middle would let a drop down to a few centimetres nearer), and some pairs within a hand of it
  let near2 = 0;
  for (let g = 0.05; g <= 0.25; g += 0.004) {
    const hm = ground(0, 0);
    for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) hm[a * H + b] += g * b * CELL / yScale;
    for (const p of standPairs(job(hm)).filter(astride)) {
      const c = clearance(hm, p);
      assert.ok(c >= 2.75 - 1e-9, `${(g * 100).toFixed(1)}% along the road: ${c.toFixed(4)} m under its lianas`);
      if (c < 2.8) near2++;
    }
  }
  assert.ok(near2 > 0, 'some within 5 cm of the law');
  // rough ground, every sample its own: a cell reaching past the band's edge is asked whole, and the road anywhere
  // under a cell could rise to it
  let rough = 0, seed = 11;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let k = 0; k < 24; k++) {
    const hm = ground(0, 0), amp = 0.5 + (k % 6) * 0.35;
    for (let i = 0; i < H * H; i++) hm[i] += rand() * amp / yScale;
    for (const p of standPairs(job(hm))) {
      const c = clearance(hm, p);
      assert.ok(c >= 2.75 - 1e-9, `rough ground ${amp.toFixed(2)} m: ${c.toFixed(4)} m under its lianas`);
      if (c < 2.8) rough++;
    }
  }
  assert.ok(rough > 0, 'some within 5 cm of the law');
  // a single rise of the road under a fig, off its cells (a grid point inside its band): 4.5 m stands, 5 m (over the
  // 2.75 m under UNDER_TOP at its scale) none
  const fig = standPairs(job(level)).find((p) => p.kind === 1 && astride(p)), q = gapOf(fig), j = Math.round(q.z / CELL);
  assert.ok(Math.abs(j * CELL - q.z) < JUNGLE_PAIR_MEASURES[1].reach * fig.js, 'the rise under it');
  const limit = fig.y + UNDER_TOP * fig.js - 2.75 - surfaceHeightAt(level, HALF, j * CELL);
  assert.ok(limit > 4.5 && limit < 5, `its limit ${limit.toFixed(3)} m`);
  const rise = (col, h) => { const hm = Float32Array.from(level); hm[col * H + j] += h / yScale; return standPairs(job(hm)).some((p) => near(p.ax, fig.ax, 1e-9) && near(p.az, fig.az, 1e-9)); };
  assert.deepEqual([rise(64, 4.5), rise(64, 5)], [true, false], 'on its line');
  assert.deepEqual([rise(65, 4.5), rise(65, 5)], [true, false], 'and at its band\'s edge, off its line and its cells');
});

test('JUNGLE-ROADSIDE the worker reads the roads by Basic Roads\' one port: world/road/pathData.js\'s GetPathsDataPoint is the travel machine\'s own (re-exported, never ported twice), and the band\'s half width is the road clearance\'s, never a second literal (mutants: a second reader; a literal half width)', () => {
  for (const k of ['pathsDataPoint', 'roadsDataPoint', 'dataPoint', 'MP_WORLD_UNITS', 'P_SIZE', 'T_SIZE', 'N', 'NW', 'PATH_ROADS']) assert.equal(travelPaths[k], pathData[k], k);
  for (const [k, v] of Object.entries({ roadRoom, ARMS, PATH_HALF_M })) assert.equal(roadVerge[k], v, k);
  assert.equal(PATH_HALF_M, PATH_HALF_WIDTH / UNITS_PER_METRE);
  assert.equal(PATH_HALF_M, 6.4);
  const band = text('src/world/road/roadBand.js');
  assert.match(band, /export const PATH_HALF_M = PATH_HALF_WIDTH \/ UNITS_PER_METRE;/);
  assert.match(band, /const bits = pathsDataPoint\(net, px \+ ix, py - iz\);/);
  assert.match(band, /import \{ pathsDataPoint, MP_WORLD_UNITS, N, NE, E, SE, S, SW, W, NW \} from '\.\/pathData\.js';/);
  const bytes = (f) => new Uint8Array(readFileSync(join(ROOT, 'vendor/roads-hazelnut', f)));
  const net = { roads: bytes('roadData.bytes'), tracks: bytes('trackData.bytes') };
  let tracks = 0;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (!net.roads[x + y * MAP_W] && pathData.pathsDataPoint(net, x, y)) tracks++;
  assert.ok(tracks > 1000, 'pixels a track alone crosses, read');
});

// ---- the layout ----------------------------------------------------------------------------------------------------

const WHOLE = [3, 3, 3, 3, 3, 3, 3, 3, 3];
const TRAILED = 402;   // a pixel whose jungle trails run under some of its road's stations
const layoutOpts = (net, px = PX) => ({ mapPixelX: px, mapPixelY: PY, rawWorldHeight: 80, climateType: 400, locationRect: null, jungle: { nine: WHOLE, pois: [], paths: new Uint8Array(16384), net } });
const layout = (net, px = PX) => jungleLayout([], ground(0, 0.5), new Uint8Array(16384).fill(2), layoutOpts(net, px));

test('JUNGLE-ROADSIDE in the layout: the pairs handed beside the flats, never among them (AUDIT JUNGLE-ROADSIDE PERF-2) - the law\'s own, off the trails; no canopy or young tree stands within `clear` of a pair\'s trunk, no plant of the floor within the canopy\'s own clearance - and away from the pairs the jungle stands as it did (mutants: the canopy over a pair\'s trunk; the young trees over it; the floor over it; the trails unasked; the network not handed on)', () => {
  const on = layout(network()), off = layout(null);
  assert.deepEqual(withJungle([], ground(0, 0.5), new Uint8Array(16384).fill(2), layoutOpts(network())), on.flats, 'withJungle its flats');
  assert.deepEqual(on.pairs, standPairs({ px: PX, py: PY, net: network(), heightmapData: ground(0, 0.5), tileOk: () => true, trailOk: (x, z, r) => trailClear(PX, PY, x, z, r) }));
  assert.ok(on.pairs.length >= 8);
  assert.deepEqual(off.pairs, []);
  assert.ok(on.flats.every((f) => Object.keys(f).every((k) => ['record', 'x', 'y', 'z', 'wood', 'archive', 'jungle', 'js'].includes(k))), 'the flats\' own fields alone');
  // the trails: a pixel where some stations' feet would stand on them
  const trailed = layout(network(TRAILED), TRAILED), every = standPairs({ px: TRAILED, py: PY, net: network(TRAILED), heightmapData: ground(0, 0.5), tileOk: () => true, trailOk: () => true });
  const onTrail = every.filter((p) => p.trees.some((t, k) => !trailClear(TRAILED, PY, t.x, t.z, JUNGLE_PAIR_MEASURES[p.kind].feet[k] * p.js)));
  assert.ok(onTrail.length > 0 && onTrail.some((p) => trailClear(TRAILED, PY, p.trees[0].x, p.trees[0].z, JUNGLE_PAIR_MEASURES[p.kind].feet[0] * p.js)), 'some over a trail, one by its second foot alone');
  assert.deepEqual(trailed.pairs, every.filter((p) => !onTrail.includes(p)), 'none over a trail');
  const trunks = on.pairs.flatMap((p) => p.trees.map((t) => [t.x, t.z, p.js]));
  const within = (f, r) => trunks.some(([x, z, js]) => Math.hypot(f.x - x, f.z - z) < r * js);
  assert.deepEqual(on.flats.filter((f) => f.jungle != null && within(f, JUNGLE_ROADSIDE.clear)), [], 'no jungle tree crowds a pair\'s trunk');
  assert.deepEqual(on.flats.filter((f) => f.jungle == null && within(f, JUNGLE.coverClear)), [], 'no plant grows out of one');
  // past a pair's clearance and the crown of the tallest tree that gave way to it (the light gap it opened, where the young
  // trees roll their gap's chance) the jungle stands as it did
  const far = (f) => !within(f, JUNGLE_ROADSIDE.clear + JUNGLE.crown * JUNGLE.emergentScale[1] + JUNGLE.underClear);
  const kept = off.flats.filter(far);
  assert.ok(kept.length > off.flats.length / 2);
  assert.deepEqual(on.flats.filter(far), kept, 'the jungle away from them as it stood');
  const gen = text('src/world/terrain/terrainGen.js');
  assert.match(gen, /const \{ flats: nature, pairs: roadside \} = jungleLayout\(/);
  assert.match(gen, /pois: placesFor\(jungle\.hidden\), paths, net: roads \}/, 'the kernel hands the jungle its network');
  assert.match(gen, /\n\s+roadside,   \/\/ JUNGLE-ROADSIDE/, 'and the pairs back beside the flats');
});

// ---- the build -----------------------------------------------------------------------------------------------------

test('JUNGLE-ROADSIDE the build stands each pair whole, a tree\'s half at its own root: each half once a kind and side in the near set - its handle held, its trees there, turned and scaled - where its tree\'s far picture stands (AUDIT JUNGLE-ROADSIDE GAME-1); each tree in its species\' group, marked for its half and never in the species\' near set; a pair stands drawn only with both halves and both species\' far pictures, else as the canopy\'s; a pair one of whose trees the build refuses stands neither; a far picture gives way to its batch\'s every handle; never Logging\'s, the door loaded or not (mutants: a lone tree kept; a half at the anchor; the turn dropped; a half unheld; its wind unwritten; a pair drawn without its species\' far picture; the fallback lost; a pair tree Logging\'s)', async () => {
  const pairs = layout(network()).pairs;
  assert.equal(keptPairs(pairs, () => true).length, pairs.length);
  const refused = pairs[0].trees[1];
  const kept = keptPairs(pairs, (x, z) => !(x === refused.x && z === refused.z));
  assert.deepEqual(kept, pairs.slice(1), 'its partner stands with it or not at all');

  const acquired = [], swayed = [], protos = new Map();
  const door = {
    pairProto: (k, side) => { const key = `${k}.${side}`; if (!protos.has(key)) protos.set(key, { key: `half${key}`, size: { h: 23 } }); return protos.get(key); },
    farPicture: async (proto) => ({ proto, record: null }),
    acquire: (h) => acquired.push(h),
  };
  const speciesPic = async (s) => ({ species: s });
  const canopy = [1, 2, 3];
  const groups = new Map([['J4', { species: 4, young: false, centers: [canopy], own: [1] }]]), handles = ['species'], set = [{ h: 0 }];
  const n = await standRoadside({ door, pairs: kept, speciesPic, groups, handles, set, sway: (proto, record) => swayed.push([proto.key, record]) });
  assert.equal(n, kept.length);
  const halves = [...new Set(kept.flatMap((p) => [`${p.kind}.0`, `${p.kind}.1`]))].sort();
  assert.deepEqual(acquired.map((h) => h.proto.key.slice(4)).sort(), halves, 'a half\'s handle held once');
  assert.deepEqual(swayed.map((s) => s[1]).sort(), halves.map((k) => JUNGLE_SPECIES[JUNGLE_PAIRS[+k[0]].trees[+k[2]]].record).sort(), 'its wind its tree\'s');
  for (const key of halves) {
    const [k, side] = key.split('.').map(Number), e = set.find((s) => handles[s.h]?.proto?.key === `half${key}`), mine = kept.filter((p) => p.kind === k);
    assert.deepEqual(e.centers, mine.map((p) => [p.trees[side].x, p.y, p.trees[side].z]), `${key}: at its tree's root, at the pair's height`);
    assert.deepEqual([...e.own], mine.map((p) => Math.fround(p.js)));
    assert.deepEqual([...e.turn], mine.map((p) => Math.fround(p.turn)));
  }
  for (const [gk, g] of groups) {
    const mine = kept.flatMap((p) => p.trees.filter((t) => `J${t.species}` === gk).map((t) => [t.x, t.y, t.z]));
    assert.deepEqual(g.centers, gk === 'J4' ? [canopy, ...mine] : mine, `${gk}: its pair trees with its own`);
    assert.deepEqual(g.centers.map((c) => g.spanned.has(c)), g.centers.map((c) => c !== canopy), `${gk}: each pair tree marked for its half`);
    const own = kept.flatMap((p) => p.trees.map((t, side) => (`J${t.species}` === gk ? `half${p.kind}.${side}` : null)).filter(Boolean));
    assert.deepEqual([...g.spans].map((h) => h.proto.key).sort(), [...new Set(own)].sort(), `${gk}: its halves' handles`);
  }
  // a species whose far picture would not stand: the pairs it is in stand as the canopy's, drawn by no half
  const noFig = new Map(), noFigSet = [];
  const nf = await standRoadside({ door, pairs: kept, speciesPic: async (s) => (s === 2 ? null : { species: s }), groups: noFig, handles: [], set: noFigSet, sway: () => {} });
  assert.equal(nf, kept.filter((p) => p.kind !== 1).length, 'the figs\' pairs undrawn');
  assert.ok(!noFigSet.some((e) => e.centers.some((c) => kept.some((p) => p.kind === 1 && c[0] === p.trees[0].x && c[2] === p.trees[0].z))), 'not even its mahogany\'s half');
  // no half: the trees stand as the canopy's own
  const plain = new Map();
  assert.equal(await standRoadside({ door: { pairProto: () => null }, pairs: kept, speciesPic, groups: plain, handles: [], set: [], sway: () => assert.fail('no half') }), 0);
  assert.deepEqual([...plain.keys()].sort(), [...new Set(kept.flatMap((p) => p.trees.map((t) => `J${t.species}`)))].sort());
  for (const [gk, g] of plain) assert.deepEqual([g.centers, g.own], [kept.flatMap((p) => p.trees.filter((t) => `J${t.species}` === gk).map((t) => [t.x, t.y, t.z])), kept.flatMap((p) => p.trees.filter((t) => `J${t.species}` === gk).map(() => p.js))], `${gk}: every pair tree, at its own scale`);
  assert.ok([...plain.values()].every((g) => !g.spanned && !g.spans));

  // a far picture gives way to any of its batch's handles a frame draws
  const a = {}, b = {}, c = {};
  assert.deepEqual([lptCuts(new Set([b]), [a, b]), lptCuts(new Set([c]), [a, b]), lptCuts(new Set([a]), a)], [true, false, true]);
  const slots = [{ cut: new Set([c]) }, { cut: new Set([b]) }];
  const r = Object.assign(Object.create(Renderer.prototype), { _lptSlots: slots });
  assert.deepEqual([r._lptFrameOf([a, b]), r._lptFrameOf([a]), r._lptFrameOf(c)], [slots[1], null, slots[0]], 'the renderer finds the frame drawing any of them');
  assert.match(text('src/render/nodeGlint.js'), /sendCut\(b\.lptProto \? frames\.find\(\(f\) => f\?\.cut && lptCuts\(f\.cut, b\.lptProto\)\) \?\? null : null\);/, 'and the glint');

  const pb = text('src/scenes/pixelBuild.js');
  assert.match(pb, /const pairs = keptPairs\(roadside, \(x, z\) => !pointNearGate\(gateClear, px, py, x, z, WOD_FLAT_GATE_CLEAR_M\) && !insideRocks\(pixelRocks, x, z\)\);/, 'kept by the gate\'s clearing and the rocks, as every flat');
  const fallback = pb.slice(pb.indexOf('    if (!jungleOk) {\n      for (const t of pairs.flatMap('), pb.indexOf('    // WOD4: THE CAMP AT PRIVATEER\'S HOLD'));
  assert.match(fallback, /addFlat\(archive, t\.record, t\.x, surfaceHeightAt\(samples, t\.x, t\.z\), t\.z, \{ wild: JUNGLE_ARCHIVE \}\);/, 'the door unloaded, its Tree records at their own ground');
  assert.doesNotMatch(fallback, /pixelTrees|tree:/, 'never Logging\'s, whatever the door (AUDIT JUNGLE-ROADSIDE GAME-2)');
  assert.doesNotMatch(pb, /f\.pair\b/, 'no pair among the flats');
  assert.match(pb, /if \(jungleOk && pairs\.length\) \{\n\s+await standRoadside\(\{\n\s+door: jungle\.door, pairs, speciesPic, groups: jungleGroups, handles: jungleHandles, set: jungleSet,/);
  assert.ok(pb.indexOf('await standRoadside(') < pb.indexOf('for (const [gk, g] of jungleGroups) {'), 'its trees join the groups before they stand');
  assert.match(pb, /const near = g\.spanned \? g\.centers\.map\(\(c\) => !g\.spanned\.has\(c\)\) : null;\n\s+jungleSet\.push\(\{ h: pic\.h, centers: near \? g\.centers\.filter\(\(_, i\) => near\[i\]\) : g\.centers, wild: null, own: near \? own\.filter\(\(_, i\) => near\[i\]\) : own, fit: null \}\);/, 'never the species\' near set - its half draws it');
  assert.match(pb, /batch\.lptProto = g\.spans \? \[far, \.\.\.g\.spans\] : far;/, 'its far picture gives way to its half');
});
