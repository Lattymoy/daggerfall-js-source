// FIGUREHEAD (2026-10-30, the owner: "Ship figurehead customizations"; bible/03-World/Naval-Refit.md FIGUREHEAD) - a carving
// her captain chooses on the Fleet page, free, stood at her stem and seen by every player who sights her: the law (the
// carvings, their numbers, the hulls with a stem, the door, the paint), the carvings built and painted, their pictures,
// her stem read and the carving fitted on every hull (the port's three, the galley's, the mod's own), the meshes made and
// let go, the real pool drawing mine, a peer's and no sea ship's, the ledger and its save, the Fleet's act and panel, the
// boats' word `h` and an older reader's, and the world's wiring. tools/mutants/figurehead.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { FIGUREHEADS, FIGUREHEAD_MAX, figureheadHull, figureheadOf, figureheadOfCode, figureheadId, carvingPaint, liveryCarvingPaint } from '../../../src/systems/naval/figurehead.js';
import { CARVING_BOX, CARVING_BUILDS, carvingModel, paintedCarving, allCarvings } from '../../../src/world/ships/figureheadModels.js';
import { FIGUREHEAD_ARCHIVE, CARVING_REC, CARVING_ART_SIZE, ROLE, roleRecords, carvingArt, recordRgb } from '../../../src/world/ships/figureheadArt.js';
import {
  stemOf, fitCarving, mountMatrix, figureSizeOf, createFigureheads, FIGURE_MIN, FIGURE_MAX, FIGURE_WATER, FIGURE_IDLE_DRAWS, FIGURE_ROOT_Z, ROPE_M, STEM_SHARE,
} from '../../../src/scenes/comeSailAway/shipFigurehead.js';
import { plankingOf } from '../../../src/scenes/comeSailAway/shipPlaque.js';
import { SHIP_PAINTS, PAINT_MAX, liveryCode } from '../../../src/systems/naval/shipLivery.js';
import { pseudoArchiveOwner } from '../../../src/world/eliteGates/pseudoArchives.js';
import { hullBuild } from '../../../src/systems/naval/navalShips.js';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayPool } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createFleetHost } from '../../../src/scenes/fleetHost.js';
import { fleetBook, fleetShip, knowShip, titleDeed, titleOf, setShipFigurehead, setShipLivery, shipFigureheadOf, fleetSaveData, restoreFleetSaveData, _resetFleetForTests } from '../../../src/systems/fleet.js';
import { mintDeed, mintBoatItem } from '../../../src/systems/comeSailAway/comeSailAwayItems.js';
import { csaWireRecord, validCsaRecord, csaRecordKey } from '../../../src/systems/comeSailAway/comeSailAwayWire.js';
import { drawFleetPage, resetFleetPage } from '../../../src/ui/fleetPage.js';
import { carvingSvg, carvingName, carvingOpen } from '../../../src/ui/figureheadPanel.js';
import { setHoldingsProvider, _setHoldingsIconForTests } from '../../../src/ui/holdingsPages.js';
import { multiply } from '../../../src/world/mat4.js';
import { freshPool, modShipsPool } from '../../navalSea.mjs';
import { scene, terrain } from '../../csaScene.mjs';
import { hostText } from '../../hostText.mjs';

const IDS = ['dragon', 'serpent', 'lion', 'eagle', 'wolf', 'maiden', 'horse', 'dreugh'];

test('FIGUREHEAD the law: eight carvings in a fixed order (their place their number), none 0; the hulls with a stem - the port\'s three and the Large Galley, never the Rowboat; the door takes a carving\'s number and refuses anything else whole, a stemless hull none; the word\'s number through it, a refused one none; her paint her livery\'s accent on a hull that takes one, past the sailcloth\'s byte (mutants: the order, the hulls, the door\'s bounds, the code, the accent)', () => {
  assert.deepEqual(FIGUREHEADS, [null, ...IDS]);
  assert.equal(FIGUREHEAD_MAX, 8);
  assert.deepEqual([0, 1, 2, 3, 4, 5, -1].map(figureheadHull), [false, true, true, true, true, false, false]);
  assert.deepEqual([0, 1, 8, null, undefined].map((v) => figureheadOf(v)), [0, 1, 8, 0, 0]);
  assert.deepEqual([9, -1, 1.5, '3', true, {}, NaN].map((v) => figureheadOf(v)), [null, null, null, null, null, null, null], 'anything else refused');
  assert.deepEqual([figureheadOf(3, 2), figureheadOf(3, 3), figureheadOf(3, 0), figureheadOf(9, 0)], [3, 3, 0, null], 'a stemless hull none; a refused number refused whatever the hull');
  assert.deepEqual([3, 9, 'x', -2, null].map(figureheadOfCode), [3, 0, 0, 0, 0]);
  assert.deepEqual([0, 1, 8, 99].map(figureheadId), [null, 'dragon', 'dreugh', null]);
  const code = liveryCode({ strake: 4, accent: 9, sail: 11 });
  assert.deepEqual([carvingPaint(2, code), carvingPaint(1, code), carvingPaint(4, code), carvingPaint(3, code), carvingPaint(0, code)], [9, 9, 9, 0, 0], 'the galley and the rowboat take no accent');
  assert.equal(carvingPaint(2, code + 0x5a0000), 9, 'the sailcloth\'s byte over the nibbles (GUILD-SHOP) is not the accent');
  assert.equal(carvingPaint(2, 0), 0, 'as built: gilt');
  assert.deepEqual([liveryCarvingPaint(4, { accent: 2 }), liveryCarvingPaint(4, null), liveryCarvingPaint(3, { accent: 2 })], [2, 0, 0]);
});

test('FIGUREHEAD the carvings: each built in code, inside CARVING_BOX, its root at her stem and leaning forward; wound outward (every role\'s volume positive); worn by role - as built its body and trim gilt, painted its body the paint and its trim gilt, its bracket oak, an eye pitch, a tooth ivory; under the archive; made once (mutants: the box, the winding, the roles, the paint)', () => {
  assert.deepEqual(Object.keys(CARVING_BUILDS), IDS);
  assert.equal(allCarvings().length, 8);
  assert.equal(carvingModel('kraken'), null);
  for (const id of IDS) {
    const m = carvingModel(id), p = m.positions;
    assert.equal(carvingModel(id), m, `${id}: built once`);
    assert.ok(m.indices.length / 3 > 250 && m.indices.length / 3 < 1200, `${id}: low-poly, ${m.indices.length / 3} faces`);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
    for (let k = 0; k < 3; k++) assert.ok(lo[k] >= CARVING_BOX[k] && hi[k] <= CARVING_BOX[k + 3], `${id}: inside its box on axis ${k} (${lo[k].toFixed(2)}..${hi[k].toFixed(2)})`);
    assert.ok(hi[2] > 0.6 && hi[1] > 0.75, `${id}: it rises forward of her stem`);
    assert.ok(Math.abs(lo[0] + hi[0]) < 0.02, `${id}: the two sides a mirror`);
    for (const s of m.subMeshes) {
      assert.equal(s.textureArchive, FIGUREHEAD_ARCHIVE);
      let vol = 0;
      for (let i = s.startIndex; i < s.startIndex + s.primitiveCount * 3; i += 3) {
        const a = m.indices[i] * 3, b = m.indices[i + 1] * 3, c = m.indices[i + 2] * 3;
        vol += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
      }
      assert.ok(vol > 0, `${id} role ${s.textureRecord}: wound outward (${vol})`);
    }
    assert.ok(m.subMeshes.some((s) => s.textureRecord === ROLE.body) && m.subMeshes.some((s) => s.textureRecord === ROLE.base) && m.subMeshes.some((s) => s.textureRecord === ROLE.eye), `${id}: a body, a bracket and eyes`);
  }
  assert.deepEqual(roleRecords(0), { [ROLE.body]: CARVING_REC.gilt, [ROLE.trim]: CARVING_REC.gilt, [ROLE.base]: CARVING_REC.oak, [ROLE.eye]: CARVING_REC.pitch, [ROLE.bone]: CARVING_REC.ivory });
  assert.deepEqual(roleRecords(2), { [ROLE.body]: 2, [ROLE.trim]: CARVING_REC.gilt, [ROLE.base]: CARVING_REC.oak, [ROLE.eye]: CARVING_REC.pitch, [ROLE.bone]: CARVING_REC.ivory });
  assert.equal(roleRecords(15)[ROLE.body], CARVING_REC.gilt, 'no paint past the last: gilt');
  const red = paintedCarving('lion', 2), built = paintedCarving('lion', 0), base = carvingModel('lion');
  assert.deepEqual(red.subMeshes.map((s) => s.textureRecord), base.subMeshes.map((s) => roleRecords(2)[s.textureRecord]));
  assert.deepEqual(built.subMeshes.map((s) => s.textureRecord), base.subMeshes.map((s) => roleRecords(0)[s.textureRecord]));
  assert.equal(red.positions, base.positions, 'the same geometry, its pictures another');
  assert.equal(paintedCarving('kraken', 2), null);
});

test('FIGUREHEAD the pictures: gilt, each of the fourteen paints carved, oak, pitch and ivory - one a record, opaque, the same on every machine; under 38194, registered (mutants: the records, the paint, the archive)', () => {
  const art = carvingArt();
  assert.deepEqual(art.map(([r]) => r), Array.from({ length: PAINT_MAX + 4 }, (_, i) => i));
  assert.deepEqual([CARVING_REC.gilt, CARVING_REC.oak, CARVING_REC.pitch, CARVING_REC.ivory], [0, 15, 16, 17]);
  const mean = (pic) => { const s = [0, 0, 0]; for (let i = 0; i < pic.colors.length; i += 4) for (let k = 0; k < 3; k++) s[k] += pic.colors[i + k]; return s.map((v) => v / (pic.colors.length / 4)); };
  for (const [rec, pic] of art) {
    assert.deepEqual([pic.width, pic.height], [CARVING_ART_SIZE, CARVING_ART_SIZE]);
    for (let i = 3; i < pic.colors.length; i += 4) assert.equal(pic.colors[i], 255, `record ${rec}: opaque`);
    const m = mean(pic), want = recordRgb(rec);
    assert.ok(m.every((v, k) => Math.abs(v - want[k]) < 42), `record ${rec}: about its colour ${want} (${m.map(Math.round)})`);
  }
  assert.ok(mean(art[0][1])[0] > mean(art[0][1])[2] + 80, 'gilt is gold');
  for (let i = 1; i <= PAINT_MAX; i++) assert.deepEqual(recordRgb(i), SHIP_PAINTS[i].rgb);
  assert.deepEqual(carvingArt().map(([, p]) => Array.from(p.colors)), art.map(([, p]) => Array.from(p.colors)), 'the same every time');
  assert.equal(FIGUREHEAD_ARCHIVE, 38194);
  assert.equal(pseudoArchiveOwner(38194)?.name, 'FIGUREHEAD_ARCHIVE');
});

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The test's own segment through a triangle (Moller-Trumbore), and two triangles crossing - none of the module's. */
function segTri(p, q, a, b, c) {
  const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = crs(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-14) return false;
  const s = sub(p, a), u = dot(s, h) / det, qq = crs(s, e1), v = dot(d, qq) / det, t = dot(e2, qq) / det;
  return u >= 0 && v >= 0 && u + v <= 1 && t >= 0 && t <= 1;
}
const triCross = (A, B) => [[A, B], [B, A]].some(([P, Q]) => [0, 1, 2].some((k) => segTri(P[k], P[(k + 1) % 3], Q[0], Q[1], Q[2])));
const triangles = (m, M = null) => {
  const out = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    out.push([0, 1, 2].map((k) => { const j = m.indices[i + k] * 3, x = m.positions[j], y = m.positions[j + 1], z = m.positions[j + 2]; return M ? [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]] : [x, y, z]; }));
  }
  return out;
};
/** A rope's face by the test's own width (the stays measure 0.057-0.071 m, the thinnest solid spar face - the Large Boat's
 *  bowsprit - 0.114): the module's ROPE_M pinned to it. */
const ROPE_WIDTH = 0.08;
const sliverOf = (t) => { const u = sub(t[1], t[0]), v = sub(t[2], t[0]); const e = Math.max(Math.hypot(...u), Math.hypot(...v), Math.hypot(...sub(v, u))); return Math.hypot(...crs(u, v)) / e < ROPE_WIDTH; };
/** A carving checked on her: stood on her stem's face, facing forward, over the water, under her stem's head, crossing
 *  nothing solid of hers, only its root on her planking - every carving, by the test's own crossing. */
function mountedOn(name, surface, build, mount) {
  const pi = plankingOf(surface, build), stem = stemOf(surface[pi], build);
  assert.ok(mount, `${name}: a mount`);
  assert.ok(Math.abs(mount.at[2] - stem.zAt(mount.at[1])) < 1e-9 && mount.at[0] === 0, `${name}: on her stem's face, on her middle line`);
  assert.ok(mount.at[1] < stem.yHead && mount.at[1] > 0, `${name}: under her stem's head`);
  assert.ok(mount.size <= figureSizeOf(build) + 1e-9 && mount.size >= figureSizeOf(build) * 0.5 - 1e-9, `${name}: her size, or smaller to fit`);
  const M = mount.matrix, fwd = [M[8], M[9], M[10]].map((v) => v / mount.size);
  assert.ok(fwd[2] > 0.85 && fwd[0] === 0, `${name}: facing forward (${fwd.map((v) => v.toFixed(2))})`);
  const near = (t) => t.some((p) => Math.abs(p[0]) < mount.size * 1.6 && Math.abs(p[1] - mount.at[1]) < mount.size * 2.5 && Math.abs(p[2] - mount.at[2]) < mount.size * 2.5);
  const solid = surface.flatMap((m, i) => (i === pi ? [] : triangles(m))).filter((t) => near(t) && !sliverOf(t));
  const planks = triangles(surface[pi]).filter(near);
  for (const id of IDS) {
    const local = triangles(carvingModel(id)), mine = triangles(carvingModel(id), M);
    assert.ok(mine.every((t) => t.every((p) => p[1] >= FIGURE_WATER - 1e-6)), `${name} ${id}: over the water`);
    for (let i = 0; i < mine.length; i++) {
      assert.ok(!solid.some((o) => triCross(mine[i], o)), `${name} ${id}: crosses nothing solid of hers`);
      if (Math.min(...local[i].map((p) => p[2])) >= FIGURE_ROOT_Z) assert.ok(!planks.some((o) => triCross(mine[i], o)), `${name} ${id}: only its root on her planking`);
    }
  }
}

test('FIGUREHEAD at every port ship\'s stem and the Large Galley\'s: her stem read by rays along her middle (its head, her bows\' alone - never the galley\'s high stern), the carving stood on its face, facing forward, under her bowsprit and her stem\'s head, crossing nothing solid of hers (her bobstay a rope), its root alone on her planking, at her size where it fits; the Rowboat none (mutants: the stem\'s rays, its bows\' share, the fit\'s crossing, the root, the rope, the water, the sizes)', async () => {
  const pool = await freshPool();
  const want = { 1: 'NewLargeBoat', 2: 'NewGalleon', 3: 'Trireme', 4: 'NewCarrack' };
  for (const hull of [1, 2, 3, 4]) {
    const s = pool.hullSurface(hull), b = hullBuild(hull), pi = plankingOf(s, b);
    assert.equal(s[pi].name, want[hull]);
    const stem = stemOf(s[pi], b);
    assert.ok(stem.zHead > b.bowZ - STEM_SHARE * (b.bowZ - b.aftZ) && stem.zHead <= b.bowZ + 0.01, `hull ${hull}: her stem's head in her bows (${stem.zHead})`);
    assert.equal(stem.zAt(stem.yHead + 0.2), null, `hull ${hull}: nothing of her stem over its head`);
    mountedOn(`hull ${hull}`, s, b, fitCarving(s, b));
  }
  assert.ok(fitCarving(pool.hullSurface(2), hullBuild(2)).size === figureSizeOf(hullBuild(2)), 'the galleon\'s at her full size');
  assert.equal(createFigureheads({ renderer: {}, surfaceOf: (h) => pool.hullSurface(h), buildOf: hullBuild }).mountOf(0), null, 'the Rowboat none');
  assert.deepEqual([figureSizeOf({ bowZ: 1, aftZ: -1 }), figureSizeOf({ bowZ: 100, aftZ: -100 }), figureSizeOf({ bowZ: 21, aftZ: -19 })], [FIGURE_MIN, FIGURE_MAX, 2]);
  assert.equal(fitCarving(null, hullBuild(2)), null);
  assert.equal(ROPE_M, ROPE_WIDTH);
  assert.equal(stemOf(null, hullBuild(2)), null);
});

test('FIGUREHEAD on the mod\'s own Large Boat and Carrack (the port ships\' models fallen back): her stem read and a carving stood on it as on a port ship (mutants: the stem)', async () => {
  const { pool, restore } = await modShipsPool();
  try {
    for (const hull of [1, 4]) { const s = pool.hullSurface(hull), b = hullBuild(hull); mountedOn(`the mod's hull ${hull}`, s, b, fitCarving(s, b)); }
  } finally { restore(); }
});

test('FIGUREHEAD the fit by its parts: a raked stem read at each height to its head and refined there, a high stern aft of her bows no stem; a spar over her stem pushes the carving down it, a rope through the same room does not; the mount\'s matrix stands its frame on her (mutants: the refinement, the rope\'s width, the matrix)', () => {
  // a wedge of a bow, its stem raked forward 0.2 a metre from 0 to 4 m high, its sides 2 m out 4 m aft; a tall stern post
  const bow = { positions: new Float64Array([0, 0, 10, 0, 4, 10.8, 2, 4, 6.8, 2, 0, 6, -2, 0, 6, -2, 4, 6.8, -2, 0, -10, 2, 0, -10, 2, 8, -10, -2, 8, -10]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 0, 4, 5, 0, 5, 1, 6, 8, 7, 6, 9, 8]) };
  const b = { bowZ: 10.8, aftZ: -10, deck: 3, top: 6, halfWidth: 2 };
  const stem = stemOf(bow, b);
  assert.ok(Math.abs(stem.yHead - 4) < 0.01, `its head ${stem.yHead}`);
  assert.ok(Math.abs(stem.zAt(2) - 10.4) < 0.01 && stem.zAt(5) === null, 'its face, and nothing over its head - the stern post aft of her bows is none');
  const box = (x0, y0, z0, x1, y1, z1) => ({ positions: new Float64Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]),
    indices: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]) });
  const planking = [bow];
  const bare = fitCarving(planking, b);
  assert.ok(bare && bare.at[1] > 3.5, `bare: at her head (${bare?.at[1]})`);
  const spar = fitCarving([...planking, box(-0.2, 4.1, 10.2, 0.2, 4.5, 14)], b);
  assert.ok(spar && spar.at[1] < bare.at[1] - 0.4 && spar.at[1] + spar.size * 0.75 < 4.1, `a spar over her stem's head: the carving down her stem, under it (${spar?.at[1]}, ${spar?.size})`);
  const rope = fitCarving([...planking, box(-0.03, 4.1, 10.2, 0.03, 4.16, 14)], b);
  assert.deepEqual(rope.at, bare.at, 'a rope through the same room: no obstacle');
  // a bow whose stem stands a hand over the water: no carving clears it
  const low = { positions: bow.positions.map((v, i) => (i % 3 === 1 ? v * 0.12 : v)), indices: bow.indices };
  assert.equal(fitCarving([low], { ...b, deck: 0.3, top: 0.5 }), null, 'none over the water');
  const M = mountMatrix([0, 2, 5], Math.PI / 2, 2);
  const at = (x, y, z) => [0, 1, 2].map((k) => M[k] * x + M[4 + k] * y + M[8 + k] * z + M[12 + k]);
  assert.deepEqual(at(0, 0, 0), [0, 2, 5]);
  assert.deepEqual(at(0, 1, 0).map((v) => Math.round(v * 1e9) / 1e9), [0, 2, 7], 'its up leant forward a quarter turn, at its size');
  assert.deepEqual(at(1, 0, 0), [2, 2, 5]);
});

/** A renderer that keeps what it is handed. */
function recordingRenderer() {
  const r = { up: new Map(), uploads: 0, released: [], made: [], destroyed: [], draws: [] };
  return Object.assign(r, {
    uploadTexture: (a, rec, c, opts) => { r.uploads++; r.up.set(`${a}_${rec}`, { c, opts }); }, releaseTexture: (a, rec) => r.released.push(`${a}_${rec}`), uploadEmissionTexture() {},
    createMesh: (model) => { const m = { model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s })) }; r.made.push(m); return m; },
    drawMesh: (gpu, m, remap) => r.draws.push({ gpu, m, remap }), updateMeshVertices() {}, createBillboardBatch: (archive, record, size, centers, opts) => ({ archive, record, size, centers, opts }),
    destroyBillboardBatch() {}, destroyMesh: (m) => r.destroyed.push(m),
  });
}

test('FIGUREHEAD the meshes made and let go: a carving\'s mesh once a carving and a paint whatever hull wears it, its pictures once under FIGUREHEAD_ARCHIVE (opaque); none for none, a stemless hull or a renderer without meshes; one not drawn for FIGURE_IDLE_DRAWS lets go of its mesh, and the pictures go once none is drawn (mutants: the cache, the pictures once, the sweep)', async () => {
  const pool = await freshPool();
  const r = recordingRenderer();
  const heads = createFigureheads({ renderer: r, surfaceOf: (h) => pool.hullSurface(h), buildOf: hullBuild });
  const a = heads.drawFor({ hull: 2 }, 3, 0);
  assert.ok(a && a.mesh.subMeshes.every((s) => s.textureArchive === FIGUREHEAD_ARCHIVE));
  assert.deepEqual(a.matrix, heads.mountOf(2).matrix);
  assert.equal(r.up.size, PAINT_MAX + 4);
  assert.ok([...r.up.values()].every((u) => u.opts.opaque === true), 'under the opaque key a made mesh asks');
  assert.equal(heads.drawFor({ hull: 4 }, 3, 0).mesh, a.mesh, 'one mesh a carving and a paint, whatever hull');
  assert.notEqual(heads.drawFor({ hull: 2 }, 3, 5).mesh, a.mesh, 'another paint, another mesh');
  assert.deepEqual([r.up.size, r.uploads], [PAINT_MAX + 4, PAINT_MAX + 4], 'the pictures once');
  assert.deepEqual([heads.drawFor({ hull: 2 }, 0, 0), heads.drawFor({ hull: 0 }, 3, 0), heads.drawFor({ hull: 2 }, 12, 0)], [null, null, null]);
  assert.equal(createFigureheads({ renderer: {}, surfaceOf: () => null, buildOf: () => null }).drawFor({ hull: 2 }, 3, 0), null, 'no meshes to make');
  for (let i = 0; i <= FIGURE_IDLE_DRAWS; i++) { heads.sweep(); if (i % 100 === 0) heads.drawFor({ hull: 2 }, 3, 0); }
  assert.equal(r.destroyed.length, 1, 'the Bay blue lion let go; the gilt one, drawn, kept');
  assert.equal(r.released.length, 0);
  for (let i = 0; i <= FIGURE_IDLE_DRAWS; i++) heads.sweep();
  assert.equal(r.destroyed.length, 2);
  assert.equal(r.released.length, PAINT_MAX + 4, 'and the pictures, none drawn');
  heads.drawFor({ hull: 2 }, 1, 0);
  assert.equal(r.up.size, PAINT_MAX + 4, 'up again when one is drawn');
});

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const standIn = () => {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  return { getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };
};

test('FIGUREHEAD over the real pool: a boat of mine carved as her ledger says, a peer\'s as her owner\'s word says, a sea ship none - each drawn in her hull\'s frame on its mount, in her trim paint; none once taken down, none while she is not drawn (mutants: mine, the peer\'s, the frame, the paint, the sweep)', async () => {
  const r = recordingRenderer();
  let mine = 4, livery = null;
  const pool = createComeSailAwayPool({ renderer: r, pipeline: standIn(), fetchFn: fileFetch, log: { warn() {} }, figureheadOf: () => mine, liveryOf: () => livery });
  assert.equal(await pool.preload(), true);
  const boat = pool.spawnNow(Object.assign(new Boat(2, 0), { uid: 7 }), { position: [5, 0, 9], rotation: [0, 0, 0, 1] });
  const carved = () => r.draws.filter((d) => d.gpu.subMeshes?.[0]?.textureArchive === FIGUREHEAD_ARCHIVE);
  boat.GameObject.position = [5, 0, 9];
  pool.draw(r);
  assert.equal(carved().length, 1, 'her carving');
  const want = multiply(boat.MeshObject.worldMatrix(), pool.figureheads.mountOf(2).matrix);
  assert.deepEqual(Array.from(carved()[0].m).map((v) => Math.round(v * 1e5) / 1e5), Array.from(want).map((v) => Math.round(v * 1e5) / 1e5), 'in her hull\'s frame, on its mount');
  assert.ok(carved()[0].gpu.subMeshes.some((s) => s.textureRecord === CARVING_REC.gilt && s.role === ROLE.body), 'as built: gilt');
  assert.equal(carved()[0].gpu.model.positions, carvingModel('eagle').positions, 'the eagle');
  livery = { strake: 0, accent: 2, sail: 0, stain: 0 };
  r.draws.length = 0;
  pool.draw(r);
  assert.ok(carved()[0].gpu.subMeshes.some((s) => s.textureRecord === 2 && s.role === ROLE.body), 'her trim paint, crimson');
  mine = 0;
  r.draws.length = 0;
  pool.draw(r);
  assert.equal(carved().length, 0, 'taken down');
  mine = 1;
  boat.GameObject.activeSelf = false;
  r.draws.length = 0;
  pool.draw(r);
  assert.equal(carved().length, 0, 'not drawn where she is not');
  boat.GameObject.activeSelf = true;
  const peer = pool.spawnPeerNow(Object.assign(new Boat(4, 0), { uid: 9, figurehead: 6, livery: liveryCode({ accent: 5 }) }));
  const sea = pool.spawnSeaNow(Object.assign(new Boat(2, 0), { figurehead: 3 }));
  r.draws.length = 0;
  pool.draw(r);
  assert.equal(carved().length, 2, 'mine and the peer\'s; a sea ship none');
  assert.ok(carved().some((d) => d.gpu.model.positions === carvingModel('maiden').positions && d.gpu.subMeshes.some((s) => s.textureRecord === 5 && s.role === ROLE.body)), 'the peer\'s maiden in her Bay blue');
  pool.remove(peer); pool.remove(sea);
});

test('FIGUREHEAD the ledger and the word: set through the door (a stemless hull none but none; a refused number never), kept in the save only when carved, read back through the door (a refused or stemless one none); a boat of mine\'s carving by her number; the boats\' word `h` only while one is carved, read back, its change said at once; a bad `h` never drops the word; an older reader keeps the boats of a word with a key it does not know (mutants: the door, the save, the restore, the word, its reader, the key)', () => {
  _resetFleetForTests();
  knowShip(41, 2, 0, 100); knowShip(42, 0, 0, 100); knowShip(43, 3, 0, 100);
  assert.deepEqual([setShipFigurehead(41, 9), setShipFigurehead(41, '3'), setShipFigurehead(99, 3)], [false, false, false]);
  assert.equal(fleetShip(41).figurehead, 0);
  assert.equal(setShipFigurehead(41, 3), true);
  assert.equal(setShipFigurehead(43, 1), true, 'the galley\'s stem');
  assert.deepEqual([setShipFigurehead(42, 3), setShipFigurehead(42, 0)], [false, true], 'the Rowboat none but none');
  assert.deepEqual([fleetShip(41).figurehead, fleetShip(42).figurehead, fleetShip(43).figurehead], [3, 0, 1]);
  assert.deepEqual([shipFigureheadOf({ uid: 41 }), shipFigureheadOf({ uid: 77 }), shipFigureheadOf({ uid: 0 }), shipFigureheadOf(null)], [3, 0, 0, 0]);
  const save = fleetSaveData();
  assert.equal(save.ships.find((s) => s.uid === 41).figurehead, 3);
  assert.equal('figurehead' in save.ships.find((s) => s.uid === 42), false, 'none: nothing said');
  restoreFleetSaveData({ ...save, ships: save.ships.map((s) => (s.uid === 42 ? { ...s, figurehead: 5 } : s.uid === 43 ? { ...s, figurehead: 77 } : s)) });
  assert.deepEqual([fleetShip(41).figurehead, fleetShip(42).figurehead, fleetShip(43).figurehead], [3, 0, 0], 'kept; a stemless one\'s and a refused one none');
  const v = (o) => ({ hull: 2, variant: 0, position: [0, 0, 0], rotation: [0, 0, 0, 1], sails: 0, helm: false, light: false, ...o });
  const rec = csaWireRecord([v({ figurehead: 3 }), v({}), v({ figurehead: 99 })]);
  assert.deepEqual(rec.h, [3, 0, 0], 'a refused number none');
  assert.equal('h' in csaWireRecord([v({}), v({ figurehead: 0 })]), false, 'none carved: none said');
  assert.deepEqual(validCsaRecord(rec).boats.map((b) => b.figurehead ?? 0), [3, 0, 0]);
  for (const h of [[3], 'x', [3, 'x', 0], [9, 9, 9]]) {
    const back = validCsaRecord({ ...rec, h });
    assert.equal(back.boats.length, 3, `never dropped for h = ${JSON.stringify(h)}`);
  }
  assert.deepEqual(validCsaRecord({ ...rec, h: [3, 'x', 0] }).boats.map((b) => b.figurehead ?? 0), [3, 0, 0]);
  assert.deepEqual(validCsaRecord({ ...rec, h: [9, 9, 9] }).boats.map((b) => b.figurehead ?? 0), [0, 0, 0]);
  assert.deepEqual(validCsaRecord({ ...rec, h: [3] }).boats.map((b) => b.figurehead ?? 0), [0, 0, 0], 'a list not one a boat: none');
  assert.notEqual(csaRecordKey(rec), csaRecordKey({ ...rec, h: [4, 0, 0] }), 'a new carving is said at once');
  assert.notEqual(csaRecordKey({ b: rec.b }), csaRecordKey({ b: rec.b, h: [1, 0, 0] }), 'and a first');
  // an older build's reader knows no `h`: its door reads no key it does not know, so the word's boats stand as before
  const older = validCsaRecord({ b: rec.b, zz: [1, 2, 3], h: rec.h });
  assert.equal(older.boats.length, 3);
});

test('FIGUREHEAD the Fleet\'s act, page and panel: carved and taken down wherever she lies, her word said again; a stemless hull and a refused carving told why; the model\'s row her stem, carving and paint; the page\'s button on a ship with a stem alone, its panel her carving drawn and a button a carving, Carve setting it, another panel shutting it; the picture drawn from the mesh in her paint (mutants: the act, the refusals, the row, the button, the panel, the picture)', () => {
  _resetFleetForTests();
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  globalThis.document = undefined;
  const s = scene({ terrains: [terrain(10, 20)] });
  let uid = 7000, changed = 0;
  s.deps.items = { create: (t) => mintBoatItem(t, ++uid), addToPlayer: () => {}, player: () => [], titles: () => fleetBook(), retitle: (boat) => !!boat };
  s.deps.isPortTown = () => true;
  titleDeed(mintDeed(2, 0, 41, 1000)); titleDeed(mintDeed(0, 0, 42, 1000));
  s.rt.SummonBoat(41, titleOf(41), fleetBook(), [100, 34, 200], [0, 0, 1], s.terrains[0]);
  const host = createFleetHost({
    csa: () => s.rt, naval: () => null, pack: () => [], gold: () => 0, pay: () => {}, accounts: () => [], regionName: () => '',
    where: () => ({ inside: false, pixel: { X: 10, Y: 20 }, feet: [100, 34, 200] }), nearPort: () => true, nearestPort: () => null, terrainAt: () => s.terrains[0],
    changed: () => { changed++; }, openHold: () => true,
  });
  const row = (u) => host.model().ships.find((x) => x.uid === u);
  setShipLivery(41, { strake: 0, accent: 13, sail: 0 });
  assert.deepEqual([row(41).carvable, row(41).figurehead, row(41).carvingPaint, row(42).carvable], [true, 0, 13, false]);
  const on = host.act(41, 'figurehead', 1);
  assert.deepEqual([on.ok, on.text, fleetShip(41).figurehead, changed], [true, 'Figurehead carved. Other players will see it.', 1, 1]);
  assert.deepEqual(host.act(41, 'figurehead', 12), { ok: false, text: 'Unknown figurehead.' });
  assert.deepEqual(host.act(42, 'figurehead', 1), { ok: false, text: 'This ship has no stem for a figurehead.' });
  const off = host.act(41, 'figurehead', 0);
  assert.deepEqual([off.ok, off.text, fleetShip(41).figurehead, changed], [true, 'Figurehead removed.', 0, 2]);
  // the page
  const el = (tag, cls, text) => {
    const n = { tag, children: [], attrs: {}, title: '', className: cls ?? '', innerHTML: '', style: { setProperty() {} }, _t: text == null ? '' : String(text), setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } };
    Object.defineProperty(n, 'textContent', { get: () => n._t + n.children.map((c) => c.textContent ?? '').join(''), set: (v) => { n._t = String(v); } });
    return n;
  };
  const all = (root, pred) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (pred(c)) out.push(c); walk(c); } }; walk(root); return out; };
  const btn = (d, text) => all(d, (c) => c.tag === 'button' && c.textContent === text);
  setHoldingsProvider({ fleet: { model: () => host.model(), offer: (u) => host.offer(u), act: (u, v, a) => host.act(u, v, a) } });
  resetFleetPage();
  const draw = () => { const d = el('div', 'px-qdetail'); drawFleetPage(d, () => {}, { el, divider: (t) => el('h4', null, t), meter: () => el('div') }); return d; };
  let d = draw();
  assert.equal(btn(d, 'Figurehead').length, 1, 'the ship with a stem alone');
  btn(d, 'Figurehead')[0].onclick();
  assert.equal(carvingOpen(41), true);
  d = draw();
  for (const id of IDS) assert.equal(btn(d, carvingName(IDS.indexOf(id) + 1)).length, 1, `${id}'s button`);
  assert.equal(btn(d, 'None').length, 1);
  assert.equal(btn(d, 'None')[0].className, 'act primary', 'as she stands: none');
  btn(d, 'Lion')[0].onclick();
  d = draw();
  assert.equal(btn(d, 'Lion')[0].className, 'act primary');
  const pic = all(d, (c) => c.attrs?.['aria-label'] === 'Figurehead preview')[0];
  assert.equal(pic.innerHTML, carvingSvg(3, 13, { width: 120 }), 'the lion drawn in her trim paint');
  btn(d, 'Carve figurehead')[0].onclick();
  assert.deepEqual([fleetShip(41).figurehead, carvingOpen(41)], [3, false], 'carved, the panel shut');
  d = draw();
  btn(d, 'Figurehead')[0].onclick();
  d = draw();
  assert.equal(btn(d, 'Remove figurehead').length, 1);
  btn(d, 'Rename')[0].onclick();
  d = draw();
  assert.deepEqual([carvingOpen(41), btn(d, 'Carve figurehead').length], [false, 0], 'another panel shuts it');
  btn(d, 'Figurehead')[0].onclick();
  resetFleetPage();
  assert.equal(carvingOpen(41), false, 'the page mounted again: shut');
  setHoldingsProvider(null);
  // the picture: her carving's own faces, in her paint
  assert.equal(carvingSvg(0, 2), '');
  const red = carvingSvg(3, 2), gilt = carvingSvg(3, 0);
  assert.match(red, /^<svg [^>]*role="img" aria-label="Lion">/);
  assert.ok((red.match(/<path /g) ?? []).length > 120, 'its faces drawn');
  const fills = (svg) => [...svg.matchAll(/fill="#([0-9a-f]{6})"/g)].map((m) => [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16)));
  const reddish = (c) => c[0] > c[1] * 2.2 && c[0] > c[2] * 2.2;
  assert.ok(fills(red).filter(reddish).length > fills(red).length / 3, 'crimson');
  assert.equal(fills(gilt).filter(reddish).length, 0, 'gilt as built');
  assert.equal(carvingSvg(3, 2), red, 'made once');
});

test('FIGUREHEAD wired: a peer\'s boat carved from her first word and on every word; the world hands the pool my ledger\'s carving and says it on my boats\' word; the pool primes each hull\'s mount while the world loads (mutants: the wiring)', () => {
  const peers = readFileSync(new URL('../../../src/scenes/comeSailAway/comeSailAwayPeers.js', import.meta.url), 'utf8');
  assert.match(peers, /s\.boat\.figurehead = w\.figurehead \?\? 0;/);
  assert.match(peers, /if \(boat\) boat\.figurehead = w\.figurehead \?\? 0;/);
  const world = hostText('src/scenes/world.js');
  assert.match(world, /figureheadOf: shipFigureheadOf,   \/\/ FIGUREHEAD: her carving at her stem/);
  assert.match(world, /figurehead: b\.uid \? fleetShip\(b\.uid\)\?\.figurehead \?\? 0 : 0,   \/\/ FIGUREHEAD: her carving/);
  const poolSrc = readFileSync(new URL('../../../src/scenes/comeSailAway/comeSailAwayPool.js', import.meta.url), 'utf8');
  assert.match(poolSrc, /for \(let hull = 0; hull < HULL_NAMES\.length; hull\+\+\) figureheads\.prime\(hull\);/);
});
