// WD1 (2026-09-25, Mac: "All mods attached are to be compatible and
// implemented 1:1") - WORLD-DATA PATCHES: a mod's whole-block world data
// carried as the author's EDIT, the block rebuilt from the player's own
// BLOCKS.BSA; and the three DFU members the sea mods' files need the port
// to read - RDB blocks out of JSON, RmbBlock3dObjectRecord's scales,
// RdbFlatResource.IsCustomData.
//
// Held here: the diff/patch round trip (a deterministic fuzz, the copy
// ops, the positional preference, the refusals); the serialiser's shape
// against the FullSerializer processors it restates; the RDB converter
// against the port's own reader (a block served from JSON lays out as the
// classic block does); the model scale at the layout and in the lighting;
// the custom marker; the loader's policy; the vendored patches' form - and,
// with ARENA2_PATH set, that every vendored patch rebuilds the author's
// file sha256 for sha256 and that a classic RDB block round-tripped
// through JSON lays out identically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { diffJson, patchJson, canonicalJson, jsonAt, blockToDfuJson, buildingToDfuJson } from '../src/formats/worldDataJson.js';
import { rebuildWorldDataPatch, canonicalSha256, PATCH_FORMAT } from '../src/formats/worldDataPatch.js';
import { blockFromJson, rdbBlockFromJson, registerWorldDataAsset, getDFBlockReplacementData, bindWorldDataBlocks, installWorldDataReplacement, _resetWorldDataReplacement } from '../src/formats/worldDataReplacement.js';
import { BlocksFile, BLOCK_TYPES, RDB_RESOURCE_TYPES } from '../src/formats/blocksFile.js';
import { layoutRdbBlock } from '../src/world/rdbLayout.js';
import { layoutRmbBlock, modelScaleVector } from '../src/world/rmbLayout.js';
import { unevenScaleNormalMatrix, StaticBatchBuilder } from '../src/render/staticBatch.js';
import { trs } from '../src/world/mat4.js';
import { collectDungeonEnemies } from '../src/characters/dungeonEnemies.js';
import { registerWorldDataPatch } from '../src/scenes/modWorldData.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && existsSync(join(ARENA2, 'BLOCKS.BSA'));

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ---- the diff ----------------------------------------------------------

test('WD1 diff/patch: a thousand random documents and edits round-trip to the canonical form', () => {
  const rnd = lcg(42);
  const gen = (d) => {
    const r = rnd();
    if (d > 3 || r < 0.3) return Math.floor(rnd() * 5);
    if (r < 0.6) return Array.from({ length: Math.floor(rnd() * 8) }, () => gen(d + 1));
    const o = {};
    for (let i = 0; i < Math.floor(rnd() * 5); i++) o[`k${Math.floor(rnd() * 6)}`] = gen(d + 1);
    return o;
  };
  const mutate = (v, d) => {
    if (rnd() < 0.2) return gen(d);
    if (Array.isArray(v)) {
      const a = v.map((x) => (rnd() < 0.3 ? mutate(x, d + 1) : x));
      if (rnd() < 0.3) a.splice(Math.floor(rnd() * (a.length + 1)), 0, gen(d + 1));
      if (a.length && rnd() < 0.3) a.splice(Math.floor(rnd() * a.length), 1);
      return a;
    }
    if (v && typeof v === 'object') {
      const o = { ...v };
      for (const k of Object.keys(o)) { if (rnd() < 0.2) delete o[k]; else if (rnd() < 0.3) o[k] = mutate(o[k], d + 1); }
      if (rnd() < 0.3) o[`n${Math.floor(rnd() * 3)}`] = gen(d + 1);
      return o;
    }
    return v;
  };
  for (let t = 0; t < 1000; t++) {
    const a = gen(0), b = mutate(a, 0);
    const before = canonicalJson(a);
    assert.equal(canonicalJson(patchJson(a, diffJson(a, b))), canonicalJson(b), `case ${t}`);
    assert.equal(canonicalJson(a), before, 'the base is never mutated');
  }
});

test('WD1 diff: an equal-length array takes element sets when that is the smaller script; an insertion is an insertion', () => {
  const A = Array.from({ length: 4096 }, (_, i) => (i % 97 === 5 ? 251 : 0));
  const B = A.slice(); B[5] = 0; B[102] = 0;
  assert.deepEqual(diffJson({ m: A }, { m: B }), [['s', ['m', 5], 0], ['s', ['m', 102], 0]], 'an automap with two bytes zeroed is two sets');
  assert.deepEqual(diffJson([1, 2, 3], [1, 9, 2, 3]), [['i', [1], 9]]);
  assert.deepEqual(diffJson([1, 2, 3], [1, 3]), [['r', [1]]]);
  assert.deepEqual(diffJson({ a: 1, b: 2 }, { a: 1, c: 3 }), [['d', ['b']], ['s', ['c'], 3]]);
  assert.deepEqual(diffJson({ a: [{ x: 1, y: 2 }] }, { a: [{ x: 1, y: 3 }] }), [['s', ['a', 0, 'y'], 3]], 'a changed record is a sub-diff when that is smaller than the record');
  assert.deepEqual(diffJson(5, 5), []);
});

test('WD1 patch: a copy op lands a classic node the patch never carries, and every bad op is refused', () => {
  const classic = { RmbBlock: { SubRecords: [{ XPos: 1, Interior: { big: 'the ship' } }] } };
  const resolve = (ref) => (ref.block === 390 ? jsonAt(classic, ref.path) : undefined);
  const ops = [
    ['ci', ['RmbBlock', 'SubRecords', 1], { block: 390, path: ['RmbBlock', 'SubRecords', 0] }],
    ['s', ['RmbBlock', 'SubRecords', 1, 'XPos'], 2527],
  ];
  const out = patchJson(classic, ops, resolve);
  assert.deepEqual(out.RmbBlock.SubRecords, [{ XPos: 1, Interior: { big: 'the ship' } }, { XPos: 2527, Interior: { big: 'the ship' } }]);
  assert.equal(classic.RmbBlock.SubRecords.length, 1, 'the classic document is untouched');
  out.RmbBlock.SubRecords[1].Interior.big = 'changed';
  assert.equal(classic.RmbBlock.SubRecords[0].Interior.big, 'the ship', 'a copy is a copy, not an alias');
  assert.throws(() => patchJson(classic, ops), /no resolver/);
  assert.throws(() => patchJson(classic, [['ci', ['x'], { block: 1, path: [] }]], () => undefined), /not found/);
  assert.throws(() => patchJson([1], [['s', [3], 0]]), /past the end/);
  assert.throws(() => patchJson([1], [['i', [3], 0]]), /outside the array/);
  assert.throws(() => patchJson([1], [['r', [1]]]), /outside the array/);
  assert.throws(() => patchJson({ a: 1 }, [['d', ['b']]]), /no key/);
  assert.throws(() => patchJson({ a: 1 }, [['z', ['a']]]), /unknown op/);
  assert.throws(() => patchJson({ a: 1 }, [['s', ['a', 'b', 'c'], 1]]), /does not reach/);
});

test('WD1 canonicalJson: keys sorted at every depth, arrays in order', () => {
  assert.equal(canonicalJson({ b: [2, { d: 1, c: 0 }], a: 'x' }), '{"a":"x","b":[2,{"c":0,"d":1}]}');
  assert.equal(canonicalJson({ a: 1, b: 2 }), canonicalJson({ b: 2, a: 1 }));
});

// ---- the serialiser ----------------------------------------------------

/** A tiny port-shaped RDB block: two roots, a model with an action, a light, a flat; a reference list with an unused slot. */
function tinyRdb() {
  const res = () => ({
    modelResource: { xRotation: 0, yRotation: 512, zRotation: 0, modelIndex: 1, triggerFlagStartingLock: 0, soundIndex: 0, actionOffset: 0,
      actionResource: { position: 0, axis: 0, duration: 0, magnitude: 0, nextObjectOffset: 0, flags: 0, previousObjectOffset: -1, nextObjectIndex: -1 } },
    flatResource: { position: 0, textureBitfield: 0, textureArchive: 0, textureRecord: 0, flags: 0, magnitude: 0, soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: 0, action: 0 },
    lightResource: { unknown1: 0, unknown2: 0, radius: 0 },
  });
  const model = { position: 100, next: 0, previous: 0, index: 0, xPos: 64, yPos: -128, zPos: 256, type: RDB_RESOURCE_TYPES.Model, resourceOffset: 0, resources: res() };
  const light = { position: 140, next: 0, previous: 0, index: 1, xPos: 1, yPos: 2, zPos: 3, type: RDB_RESOURCE_TYPES.Light, resourceOffset: 0, resources: res() };
  light.resources.lightResource = { unknown1: 16, unknown2: 0, radius: 100 };
  const flat = { position: 180, next: 0, previous: 0, index: 0, xPos: 10, yPos: -20, zPos: 30, type: RDB_RESOURCE_TYPES.Flat, resourceOffset: 0, resources: res() };
  flat.resources.flatResource = { position: 190, textureBitfield: (211 << 7) | 9, textureArchive: 211, textureRecord: 9, flags: 5, magnitude: 0, soundIndex: 2, factionOrMobileId: 512, nextObjectOffset: -2, action: 0 };
  return {
    position: 27698669, index: 1016, name: 'W0000000.RDB', type: BLOCK_TYPES.Rdb, rmbBlock: null, rdiBlock: null,
    rdbBlock: {
      position: 0, header: null, modelDataList: null, objectHeader: null, unknownObjectList: null,
      modelReferenceList: [
        { modelId: '63130', modelIdNum: 63130, description: 'C0L' },
        { modelId: '63104', modelIdNum: 63104, description: 'C29' },
        { modelId: '', modelIdNum: 0, description: '���' },
        { modelId: '99999', modelIdNum: 99999, description: 'XXX' },
      ],
      objectRootList: [{ rootOffset: 4, rdbObjects: [model, light] }, { rootOffset: -1, rdbObjects: null }, { rootOffset: 8, rdbObjects: [flat] }],
    },
  };
}

test('WD1 blockToDfuJson (RDB): the processors\' shape - the list cut at the first unused slot, each object\'s resources pruned to its type, the default RMB half', () => {
  const j = blockToDfuJson(tinyRdb());
  assert.deepEqual(Object.keys(j), ['Position', 'Index', 'Name', 'Type', 'RmbBlock', 'RdbBlock', 'RdiBlock']);
  assert.equal(j.Type, 'Rdb');
  assert.deepEqual(j.RdbBlock.ModelReferenceList, [{ ModelId: '63130', ModelIdNum: 63130, Description: 'C0L' }, { ModelId: '63104', ModelIdNum: 63104, Description: 'C29' }],
    'RdbBlockDescProcessor: cut at the first "\\uFFFD\\uFFFD\\uFFFD", whatever follows');
  const [m, l] = j.RdbBlock.ObjectRootList[0].RdbObjects;
  assert.deepEqual(Object.keys(m.Resources), ['ModelResource']);
  assert.deepEqual(Object.keys(l.Resources), ['LightResource']);
  assert.deepEqual(l.Resources.LightResource, { Unknown1: 16, Unknown2: 0, Radius: 100 });
  assert.equal(j.RdbBlock.ObjectRootList[1].RdbObjects, null);
  assert.deepEqual(j.RdbBlock.ObjectRootList[2].RdbObjects[0].Resources, { FlatResource: {
    Position: 190, TextureArchive: 211, TextureRecord: 9, Flags: 5, Magnitude: 0, SoundIndex: 2, FactionOrMobileId: 512, NextObjectOffset: -2, Action: 0 } });
  assert.deepEqual(j.RmbBlock.FldHeader.GroundData, {}, 'RmbGroundDataConverter writes nothing for a null header');
  assert.equal(j.RmbBlock.SubRecords, null);
  assert.deepEqual(j.RdiBlock, { Data: null });
});

test('WD1 rdbBlockFromJson: a block served from its JSON lays out as the classic block does', () => {
  const classic = tinyRdb();
  const served = blockFromJson(blockToDfuJson(classic), 1016);
  assert.equal(served.type, BLOCK_TYPES.Rdb);
  assert.equal(served.rmbBlock, null);
  assert.equal(served.position, 27698669, 'the LoadID base (RDBLayout.cs:242) survives');
  const getModel = () => ({ positions: new Float32Array(3), doors: [] });
  const strip = (lay) => ({ ...lay, actionLinks: [...lay.actionLinks], objectPositions: [...lay.objectPositions] });
  assert.deepEqual(strip(layoutRdbBlock(served, 1016, true, getModel)), strip(layoutRdbBlock(classic, 1016, true, getModel)));
  // a resource the JSON left out is DFU's default struct - zeros - not the reader's -1s
  const flat = served.rdbBlock.objectRootList[2].rdbObjects[0];
  assert.deepEqual(flat.resources.modelResource.actionResource,
    { position: 0, axis: 0, duration: 0, magnitude: 0, nextObjectOffset: 0, flags: 0, previousObjectOffset: 0, nextObjectIndex: 0 });
  assert.equal(flat.resources.flatResource.isCustomData, false);
  assert.equal(rdbBlockFromJson({ ObjectRootList: [{ RdbObjects: [{ Type: 'Flat', Resources: { FlatResource: { IsCustomData: true } } }] }] }).objectRootList[0].rdbObjects[0].resources.flatResource.isCustomData, true);
});

test('WD1 the door serves an RDB block from JSON (AUDIT-RR2 G14 lifted) and never applies building files to it', () => {
  _resetWorldDataReplacement();
  installWorldDataReplacement();
  const json = blockToDfuJson(tinyRdb());
  registerWorldDataAsset('W0000000.RDB.json', json);
  const got = getDFBlockReplacementData(1016, 'W0000000.RDB');
  assert.ok(got?.rdbBlock);
  assert.equal(got.index, 1016);
  assert.equal(got.rdbBlock.objectRootList[0].rdbObjects.length, 2);
  registerWorldDataAsset('W0000000.RDB.json', json, () => false);
  _resetWorldDataReplacement({ assets: false }); installWorldDataReplacement();
  assert.equal(getDFBlockReplacementData(1016, 'W0000000.RDB'), null, 'a mod that is off is a mod DFU never loaded');
  _resetWorldDataReplacement();
});

// ---- the model scale ----------------------------------------------------

test('WD1 RmbBlock3dObjectRecord scales: carried as float32, zero read as 1, applied at the layout', () => {
  const b = blockFromJson({
    Name: 'SHIPAA00.RMB', Type: 'Rmb',
    RmbBlock: { FldHeader: {}, SubRecords: [{ XPos: 0, ZPos: 0, YRotation: 0, Exterior: { Block3dObjectRecords: [
      { ModelId: '910', ModelIdNum: 910, XPos: 0, YPos: 0, ZPos: 0, XScale: 0.8999999, YScale: 2, ZScale: 0.5 },
      { ModelId: '911', ModelIdNum: 911, XPos: 0, YPos: 0, ZPos: 0 },
    ] }, Interior: {} }], Misc3dObjectRecords: [{ ModelId: '41832', ModelIdNum: 41832, XScale: 1.29 }] },
  }, 390);
  const [a, c] = b.rmbBlock.subRecords[0].exterior.block3dObjectRecords;
  assert.equal(a.xScale, Math.fround(0.8999999));
  assert.deepEqual(modelScaleVector(a), [Math.fround(0.8999999), 2, 0.5]);
  assert.deepEqual(modelScaleVector(c), [1, 1, 1], 'RMBLayout.GetModelScaleVector: a zero is 1');
  const lay = layoutRmbBlock(b);
  const col = (m, i) => Math.hypot(m[i * 4], m[i * 4 + 1], m[i * 4 + 2]);
  assert.ok(Math.abs(col(lay.models[0].matrix, 0) - Math.fround(0.8999999)) < 1e-6);
  assert.ok(Math.abs(col(lay.models[0].matrix, 1) - 2) < 1e-6);
  assert.ok(Math.abs(col(lay.models[0].matrix, 2) - 0.5) < 1e-6);
  assert.ok(Math.abs(col(lay.models[1].matrix, 0) - 1) < 1e-6);
  assert.ok(Math.abs(col(lay.models[2].matrix, 0) - Math.fround(1.29)) < 1e-6, 'the misc model too (RMBLayout.cs:918)');
  // and the serialiser drops a zero scale, as RmbBlock3dObjectRecordProcessor does
  const back = blockToDfuJson(b).RmbBlock.SubRecords[0].Exterior.Block3dObjectRecords;
  assert.ok('XScale' in back[0] && !('XScale' in back[1]));
});

test('WD1 a model scaled unevenly lights through its inverse transpose; an even one through itself', () => {
  const m = trs(3, 4, 5, 10, 37, -20, 0.5, 2, 1.3);
  const n = unevenScaleNormalMatrix(m);
  const apply = (mm, v) => [mm[0] * v[0] + mm[4] * v[1] + mm[8] * v[2], mm[1] * v[0] + mm[5] * v[1] + mm[9] * v[2], mm[2] * v[0] + mm[6] * v[1] + mm[10] * v[2]];
  const t = [1, 0.2, -0.3], nr = [0.2, -1, 0];   // a surface's tangent and normal: t . nr = 0
  const T = apply(m, t), N = apply(n, nr);
  assert.ok(Math.abs(T[0] * N[0] + T[1] * N[1] + T[2] * N[2]) < 1e-6, 'the transformed normal stays perpendicular to the transformed surface');
  const N0 = apply(m, nr);
  assert.ok(Math.abs(T[0] * N0[0] + T[1] * N0[1] + T[2] * N0[2]) > 1e-3, 'the model matrix itself would not');
  assert.equal(unevenScaleNormalMatrix(trs(0, 0, 0, 10, 20, 30, 2, 2, 2)), null);
  assert.equal(unevenScaleNormalMatrix(trs(0, 0, 0, 10, 20, 30)), null);
  const mirrored = unevenScaleNormalMatrix(trs(0, 0, 0, 0, 0, 0, -1, 2, 1));
  assert.ok(apply(mirrored, [0, 1, 0])[1] > 0, 'a mirror does not turn a normal inward');
  // ...and the batch every block model is merged into uses it without being told (a world-data model carries no normal matrix of its own)
  const s2 = Math.SQRT1_2;
  const cpu = { positions: new Float32Array([0, 0, 0, 1, 1, 0, 0, 0, 1]), normals: new Float32Array([s2, -s2, 0, s2, -s2, 0, s2, -s2, 0]), uvs: new Float32Array(6), indices: new Uint32Array([0, 1, 2]), subMeshes: [{ textureArchive: 1, textureRecord: 2, startIndex: 0, primitiveCount: 1 }] };
  const batch = new StaticBatchBuilder();
  batch.add(cpu, trs(0, 0, 0, 0, 0, 0, 4, 1, 1), () => '1_2');
  const out = batch.finish();
  const nx = out.normals[0], ny = out.normals[1];
  // the surface's in-plane direction (1,1,0) scales to (4,1,0); its normal must stay perpendicular to that
  assert.ok(Math.abs(nx * 4 + ny * 1) < 1e-5, `normal (${nx}, ${ny}) is perpendicular to the stretched surface`);
});

// ---- the custom marker --------------------------------------------------

test('WD1 RdbFlatResource.IsCustomData: a custom fixed marker is its whole FactionOrMobileId and is not skipped at 99', () => {
  const block = (m) => ({ originX: 0, originZ: 0, waterLevel: 10000, markers: [m] });
  const marker = (factionOrMobileId, isCustomData) => ({ record: 16, x: 0, y: 0, z: 0, rawY: 0, flags: 0, factionOrMobileId, soundIndex: 0, actionByte: 0, isCustomData });
  const opts = { locationId: 1, dungeonType: 0, alternate: false };
  assert.equal(collectDungeonEnemies([block(marker(0x1203, false))], opts)[0].mobileType, 0x03, 'classic: the garbage MSBs masked');
  assert.equal(collectDungeonEnemies([block(marker(0x1203, true))], opts)[0].mobileType, 0x1203, 'custom: all sixteen bits (RDBLayout.cs:1479-1482)');
  assert.equal(collectDungeonEnemies([block(marker(0x0163, false))], opts).length, 0, 'classic 99 is skipped');
  assert.equal(collectDungeonEnemies([block(marker(99, true))], opts).length, 1, 'a custom marker never is');
});

// ---- the loader -----------------------------------------------------------

function fakeBlocks(dfBlock) {
  return { getBlockName: (i) => (i === dfBlock.index ? dfBlock.name : null), readClassicBlock: (i) => (i === dfBlock.index ? structuredClone(dfBlock) : null) };
}

test('WD1 registerWorldDataPatch: rebuilt and served under its DFU name; a foreign BSA is said and served; ops that do not land are said and not served', async () => {
  const classic = tinyRdb();
  const base = blockToDfuJson(classic);
  const mod = structuredClone(base);
  mod.RdbBlock.ObjectRootList[1].RdbObjects = [{ Position: 9, Index: 0, XPos: 1, YPos: 2, ZPos: 3, Type: 'Flat', Resources: { FlatResource: { Position: 0, TextureArchive: 105, TextureRecord: 1, Flags: 0, Magnitude: 0, SoundIndex: 0, FactionOrMobileId: 0, NextObjectOffset: 0, Action: 0 } } }];
  const patch = { format: PATCH_FORMAT, rebuilds: 'W0000000.RDB.json', base: { kind: 'block', block: 'W0000000.RDB', index: 1016 }, sha256: await canonicalSha256(mod), ops: diffJson(base, mod) };
  assert.equal(canonicalJson(rebuildWorldDataPatch(patch, fakeBlocks(classic))), canonicalJson(mod));
  const warn = console.warn, error = console.error;
  const said = [];
  console.warn = (m) => said.push(String(m)); console.error = (m) => said.push(String(m));
  try {
    _resetWorldDataReplacement(); installWorldDataReplacement();
    bindWorldDataBlocks(fakeBlocks(classic));
    assert.equal(await registerWorldDataPatch(patch, null), true);
    assert.equal(getDFBlockReplacementData(1016, 'W0000000.RDB').rdbBlock.objectRootList[1].rdbObjects[0].resources.flatResource.textureArchive, 105);
    assert.deepEqual(said, []);
    // another BSA's block under the same name: rebuilt, said, served
    const other = tinyRdb(); other.rdbBlock.objectRootList[0].rdbObjects[0].xPos = 65;
    _resetWorldDataReplacement(); installWorldDataReplacement(); bindWorldDataBlocks(fakeBlocks(other));
    assert.equal(await registerWorldDataPatch(patch, null), true);
    assert.match(said.join('\n'), /not to the author's file/);
    // a block that is not the named one at the index: not served
    said.length = 0;
    const wrong = tinyRdb(); wrong.name = 'W0000001.RDB';
    _resetWorldDataReplacement(); installWorldDataReplacement(); bindWorldDataBlocks(fakeBlocks(wrong));
    assert.equal(await registerWorldDataPatch(patch, null), false);
    assert.match(said.join('\n'), /wants W0000000\.RDB at block 1016/);
    // no BSA bound: not served
    _resetWorldDataReplacement(); installWorldDataReplacement();
    assert.equal(await registerWorldDataPatch(patch, null), false);
  } finally {
    console.warn = warn; console.error = error;
    _resetWorldDataReplacement();
  }
});

// ---- the vendored patches -------------------------------------------------

const PATCH_DIRS = readdirSync(join(ROOT, 'vendor'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'vendor', d.name, 'WorldDataPatches')))
  .flatMap((d) => readdirSync(join(ROOT, 'vendor', d.name, 'WorldDataPatches')).map((f) => `vendor/${d.name}/WorldDataPatches/${f}`));

test('WD1 the vendored patches: the format, a base named by block and index, the author\'s sha256 - and no whole block', () => {
  assert.ok(PATCH_DIRS.length >= 3, PATCH_DIRS.join(', '));
  for (const f of PATCH_DIRS) {
    const p = JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
    assert.equal(p.format, PATCH_FORMAT, f);
    assert.equal(p.rebuilds, f.split('/').pop(), `${f}: a patch is named for the file it rebuilds`);
    assert.match(p.base.block, /^[A-Z0-9]{8}\.(RMB|RDB)$/, f);
    assert.ok(Number.isInteger(p.base.index) && p.base.index >= 0, f);
    assert.match(p.sha256, /^[0-9a-f]{64}$/, f);
    for (const op of p.ops) {
      assert.ok(op[1].length > 0, `${f}: no op replaces the whole document`);
      assert.ok(['s', 'd', 'i', 'r', 'ci', 'cs'].includes(op[0]), `${f}: ${op[0]}`);
    }
  }
  const aquatic = PATCH_DIRS.filter((f) => f.startsWith('vendor/aquatic-sprites/')).map((f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8')));
  // The canonical sha256 of each shipped file (Aquatic_Sprites_1.0-276-1-0-1642914017.zip).
  assert.deepEqual(Object.fromEntries(aquatic.map((p) => [p.base.block, [p.base.index, p.sha256]])), {
    'W0000000.RDB': [1016, 'c6560c6c966b7aee5231d13426a52065c038fccb101ca80cf87ede0514080daa'],
    'W0000008.RDB': [1024, '06dcd928f4836a9f547c3e561b6e5376f4cbfb8b6a3bb4f2ca3d775293a989a7'],
    'W0000023.RDB': [1039, '0cd9f30eec3db9e76bfcac8340022d6c4a4063cf1a5d280813aeece50887389d'],
  });
  // Every sprite Aquatic Sprites adds is a flat of archive 105 or 106 - no other kind of record rides in.
  let added = 0;
  for (const p of aquatic) {
    for (const op of p.ops) {
      if (op[0] !== 'i') continue;
      assert.equal(op[2].Type, 'Flat');
      assert.ok([105, 106].includes(op[2].Resources.FlatResource.TextureArchive));
      added++;
    }
  }
  assert.equal(added, 32 + 48 + 39);
});

test('WD1 with ARENA2: every vendored patch rebuilds the author\'s file sha256 for sha256', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async () => {
  const blocks = new BlocksFile();
  assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  for (const f of PATCH_DIRS) {
    const p = JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
    const json = rebuildWorldDataPatch(p, blocks);
    assert.equal(createHash('sha256').update(canonicalJson(json)).digest('hex'), p.sha256, f);
  }
});

test('WD1 with ARENA2: a classic RDB and RMB block through JSON and back lay out as the block itself', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, () => {
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const getModel = () => ({ positions: new Float32Array(3), doors: [] });
  const strip = (lay) => ({ ...lay, actionLinks: [...lay.actionLinks], objectPositions: [...lay.objectPositions] });
  for (const index of [1016, 1024, 1039, 994, 1025]) {
    const classic = blocks.readClassicBlock(index);
    const served = blockFromJson(blockToDfuJson(classic), index);
    assert.deepEqual(strip(layoutRdbBlock(served, index, true, getModel)), strip(layoutRdbBlock(classic, index, true, getModel)), `block ${index}`);
  }
  for (const index of [390, 630]) {
    const classic = blocks.readClassicBlock(index);
    const served = blockFromJson(blockToDfuJson(classic), index);
    assert.deepEqual(layoutRmbBlock(served).models, layoutRmbBlock(classic).models, `block ${index}`);
    assert.deepEqual(buildingToDfuJson(served, 0), buildingToDfuJson(classic, 0), `block ${index}: the building record`);
  }
});
