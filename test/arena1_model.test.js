// ARENA1 (2026-10-02): THE COLOSSEUM REBUILT (src/world/arenaModel.js) - Kamer's half out of the vendored binary, the
// undercroft's pieces out of the player's ARCH3D, one model; registered as 864102 climate-free, its pieces' pictures
// loaded before the build (src/world/customModels.js, src/scenes/dataPipeline.js); drawn by its own table and given
// its collider in the two hosts that stand towns (src/scenes/world.js, src/scenes/exterior.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pieceTransform, arenaPieceModel, composeArenaModel, buildArenaModel, decodeArenaModel, ARENA_MODEL_ID, PIECE_TURNS } from '../src/world/arenaModel.js';
import { registerCustomModel, customModelFor, isClimateFreeModel, customModelNeeds, _resetCustomModels, NO_CLIMATE_REMAP } from '../src/world/customModels.js';
import { HAS_ARENA2, classicModels, vendorBytes } from './arena1Data.mjs';

const idx = JSON.parse(readFileSync(new URL('../vendor/daggerfall-arena/Models/864102.json', import.meta.url), 'utf8'));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('ARENA1 model: a piece\'s turn - quarter turns about +Y, (x, z) -> (-z, x) each, a mirror in x before them', () => {
  assert.equal(PIECE_TURNS, 8);
  assert.deepEqual(pieceTransform([1, 2, 3], 0), [1, 2, 3]);
  assert.deepEqual(pieceTransform([1, 2, 3], 1), [-3, 2, 1]);
  assert.deepEqual(pieceTransform([1, 2, 3], 2), [-1, 2, -3]);
  assert.deepEqual(pieceTransform([1, 2, 3], 3), [3, 2, -1]);
  assert.deepEqual(pieceTransform([1, 2, 3], 4), [-1, 2, 3]);
  assert.deepEqual(pieceTransform([1, 2, 3], 5), [-3, 2, -1]);
});

/** A two-triangle classic model: a quad in x/z, two pictures. */
const quad = () => ({
  positions: Float32Array.from([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]), normals: Float32Array.from([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
  uvs: Float32Array.from([0, 0, 1, 0, 1, 1, 0, 1]), indices: Uint32Array.from([0, 1, 2, 0, 2, 3]),
  subMeshes: [{ textureArchive: 10, textureRecord: 1, startIndex: 0, primitiveCount: 1 }, { textureArchive: 10, textureRecord: 2, startIndex: 3, primitiveCount: 1 }],
});

test('ARENA1 model: a piece keeps the triangles it names, under the picture it names, placed - and a mirrored one wound back out', () => {
  const p = arenaPieceModel(quad(), { model: 1, turn: 0, at: [5, 0, 0], keep: [1], retexture: { 1: [20, 3] } });
  assert.equal(p.indices.length, 3);
  assert.deepEqual(p.subMeshes, [{ textureArchive: 20, textureRecord: 3, startIndex: 0, primitiveCount: 1 }]);
  assert.deepEqual([...p.positions], [5, 0, 0, 6, 0, 1, 5, 0, 1]);
  assert.deepEqual([...p.uvs], [0, 0, 1, 1, 0, 1]);
  const m = arenaPieceModel(quad(), { model: 1, turn: 4, at: [0, 0, 0], keep: 'all' });
  assert.equal(m.indices.length, 6);
  // the first triangle (0,1,2) mirrored: x negated and the corners in reverse - (2,1,0)
  assert.deepEqual([...m.positions.slice(0, 9)].map((x) => x + 0), [-1, 0, 1, -1, 0, 0, 0, 0, 0]);
  assert.deepEqual(m.subMeshes.map((s) => [s.textureArchive, s.textureRecord, s.startIndex, s.primitiveCount]), [[10, 1, 0, 1], [10, 2, 3, 1]]);
});

test('ARENA1 model: the parts merge end to end - each part\'s indices past the vertices before it; ARENA-FIX 5: one submesh a picture', () => {
  const a = arenaPieceModel(quad(), { model: 1, turn: 0, at: [0, 0, 0], keep: 'all' });
  const b = arenaPieceModel(quad(), { model: 1, turn: 0, at: [0, 0, 0], keep: [0] });
  const m = composeArenaModel([a, b]);
  assert.equal(m.positions.length, (6 + 3) * 3);
  // (10,1) is a's first triangle and b's only one, together; (10,2) a's second - the pictures in the order first met
  assert.deepEqual([...m.indices], [0, 1, 2, 6, 7, 8, 3, 4, 5]);
  assert.deepEqual(m.subMeshes.map((s) => [s.textureArchive, s.textureRecord, s.startIndex, s.primitiveCount]), [[10, 1, 0, 2], [10, 2, 6, 1]]);
  assert.deepEqual(m.doors, []);
});

test('ARENA1 model: 864102 registers climate-free, naming the pieces it reads; the build is handed the classic reader', () => {
  _resetCustomModels();
  const seen = [];
  registerCustomModel(ARENA_MODEL_ID, (ctx) => { seen.push(ctx); return decodeArenaModel(idx, vendorBytes('Models/864102.bin')); }, () => true, { climateFree: true, needs: [63000, 72006] });
  assert.equal(isClimateFreeModel(ARENA_MODEL_ID), true);
  assert.equal(isClimateFreeModel(41601), false);
  assert.deepEqual([...customModelNeeds(ARENA_MODEL_ID)], [63000, 72006]);
  const ctx = { classicModel: () => null };
  assert.ok(customModelFor(ARENA_MODEL_ID, ctx));
  assert.equal(seen[0], ctx);
  assert.equal(NO_CLIMATE_REMAP.size, 0);
  _resetCustomModels();
  // the pipeline loads the pieces' pictures first and hands the build its classic reader
  const pipe = read('src/scenes/dataPipeline.js');
  // AUDIT PRE-MERGE 1003 W6: through the door that lets a build breathe (customModelBuilt - customModelFor's, or the sliced one)
  assert.match(pipe, /for \(const id of customModelNeeds\(modelIdNum\)\) \{[\s\S]{0,200}await getTexture\(sm\.textureArchive\);[\s\S]{0,40}\}\s*const custom = await customModelBuilt\(modelIdNum, \{ classicModel: classicModelOf \}, breathe\);/);
  assert.match(pipe, /return i === -1 \? null : dfMeshToModel\(arch\.getMesh\(i\), getTextureSize\);/, 'the record as ARCH3D holds it - no seam patched');
});

test('ARENA1 model: the hosts draw a climate-free model by its own table and give it the collider every placed model gets', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const climateFree = isClimateFreeModel\(placed\.modelIdNum\);[^\n]*\n\s*if \(!climateFree\) await remapSubMeshes\(gpu\.subMeshes, texRemap, townClimateArchive, pipeline\);/);
  assert.match(w, /if \(climateFree\) entry\.texRemap = NO_CLIMATE_REMAP;/);
  assert.match(w, /staticBuilder\.add\(cpu, local, climateFree \? ownTexKey : resolveTexKey\)/);
  assert.match(w, /const ownTexKey = keyResolver\(NO_CLIMATE_REMAP\);/);
  assert.match(w, /collider\.addMesh\(gateKey, cpu\.positions, cpu\.indices, local,/, 'the world host: the mesh collider of every placed model (the colosseum\'s tiers, floor and walls)');
  const e = read('src/scenes/exterior.js');
  assert.match(e, /if \(isClimateFreeModel\(id\)\) continue;[^\n]*\n\s*await remapSubMeshes\(gpu\.subMeshes, texRemap, climateArchive, pipeline\);/);
  assert.match(e, /if \(isClimateFreeModel\(placed\.modelIdNum\)\) entry\.texRemap = NO_CLIMATE_REMAP;/);
  assert.match(e, /renderer\.drawMesh\(d\.mesh, d\.matrix, d\.texRemap \?\? texRemap\);/);
  assert.match(e, /collider\.addMesh\(bucketKey, cpu\.positions, cpu\.indices, matrix\);/, 'the city host: the same');
});

test('ARENA1 model (ARENA2): rebuilt from the player\'s ARCH3D - 5,138 triangles, the bundle\'s bounds, every piece\'s triangles in its model', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const classicOf = classicModels();
  let pieceTris = 0;
  for (const p of idx.pieces) {
    const c = classicOf(p.model);
    assert.ok(c, `ARCH3D has ${p.model}`);
    const n = c.indices.length / 3;
    const keep = p.keep === 'all' ? n : p.keep.length;
    if (p.keep !== 'all') assert.ok(p.keep.every((t) => t >= 0 && t < n));
    pieceTris += keep;
  }
  assert.equal(pieceTris, 365);
  const m = buildArenaModel(idx, vendorBytes('Models/864102.bin'), classicOf);
  assert.equal(m.indices.length / 3, 5138);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], m.positions[i + k]); max[k] = Math.max(max[k], m.positions[i + k]); }
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(min[k] - idx.source.bounds.min[k]) < 1e-3 && Math.abs(max[k] - idx.source.bounds.max[k]) < 1e-3, `axis ${k}`);
  }
  // the pieces lie in the undercroft, under the floor
  const own = decodeArenaModel(idx, vendorBytes('Models/864102.bin'));
  let top = -Infinity;
  for (let i = own.positions.length; i < m.positions.length; i += 3) top = Math.max(top, m.positions[i + 1]);
  assert.ok(top < 0.5, `the pieces' highest corner ${top} - the passages' ceilings, low under the stands (the walls stand to 20.7)`);
  // a missing record is that piece not drawn, never a thrown build
  assert.equal(buildArenaModel(idx, vendorBytes('Models/864102.bin'), () => null).indices.length / 3, 4773);
});
