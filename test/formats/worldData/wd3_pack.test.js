// WD3 (2026-10-01, Mac: "These are the next mods I'd like to implement (We have permission) and ensure this doesn't
// conflict or regress anything (For example housing customization)") - THE WORLD-DATA PACK: Beautiful Villages of
// Daggerfall's and Beautiful Cities of Daggerfall's whole world data carried as the authors' edits over the player's
// own MAPS.BSA and BLOCKS.BSA (src/formats/worldData/worldDataPack.js), built by tools/worldDataPackBuild.mjs.
//
// Held here: the record rows (every codec round-trips DFU's object, key order and all, and a record that does not fit
// is carried whole); the reader (a file rebuilt from a classic block, a node shared, a classic node referenced with
// the author's edits to it, rows, runs, the run op; a file based on another, kept once; the shipped form - every entry
// and node JSON text - read the same; what it lets go); its refusals, each by name; the gzip and the hash the loader
// reads a pack through. OWN-WORK3 (2026-10-31): both town mods are retired and their packs left the tree, so the
// vendored packs' form and their sha256 rebuild over ARENA2 went with them; the format and its reader are held here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';

import { PACK_FORMAT, ROW_CODECS, ROW_ENCODERS, runLength, openWorldDataPack, readPackText, packFileSha256, classicIndicesOf } from '../../../src/formats/worldData/worldDataPack.js';
import { blockToDfuJson, patchJson, canonicalJson } from '../../../src/formats/worldData/worldDataJson.js';
import { canonicalSha256 } from '../../../src/formats/worldData/worldDataPatch.js';
import { parseFullSerializerJson, dfuWorldDataName, serialisePack } from '../../../tools/worldDataPackBuild.mjs';
import { tinyRmb, fakeBlocks } from '../../wd3Fakes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sha = (json) => createHash('sha256').update(canonicalJson(json)).digest('hex');

const SUB0 = ['RmbBlock', 'SubRecords', 0];
const EXT0 = [...SUB0, 'Exterior', 'Block3dObjectRecords'];

// ---- the rows ---------------------------------------------------------------------------------------------------------
test('WD3 pack rows: every record codec reads back the DFU object it was written from, key for key and in DFU\'s order; a record that does not fit its codec exactly is carried whole', () => {
  const j = blockToDfuJson(tinyRmb());
  const ext = j.RmbBlock.SubRecords[0].Exterior;
  const samples = {
    $m: [...ext.Block3dObjectRecords, ...j.RmbBlock.Misc3dObjectRecords, { ModelId: '5', ModelIdNum: 5, ObjectType: 0, XPos: 0, YPos: 0, ZPos: 0, YScale: 2, ZScale: 0.5, XRotation: 1, YRotation: 2, ZRotation: 3 }],
    $f: [...ext.BlockFlatObjectRecords, ...j.RmbBlock.MiscFlatObjectRecords, { Position: 0, XPos: 0, YPos: 0, ZPos: 0, TextureArchive: 0, TextureRecord: 0, FactionID: 0, Flags: 0 }],
    $d: ext.BlockDoorRecords,
    $3: ext.BlockSection3Records,
    $b: [...j.RmbBlock.FldHeader.BuildingDataList, { NameSeed: 1, FactionId: 2, Sector: 3, LocationId: 4, BuildingType: 18, Quality: 5 }],
    $t: j.RmbBlock.FldHeader.GroundData.GroundTiles.slice(0, 40),
    $g: j.RmbBlock.FldHeader.GroundData.GroundScenery.slice(0, 40),
  };
  assert.deepEqual(Object.keys(ROW_CODECS).sort(), Object.keys(ROW_ENCODERS).sort(), 'an encoder for every codec');
  for (const [k, list] of Object.entries(samples)) {
    assert.ok(list.length, k);
    for (const o of list) {
      const row = ROW_ENCODERS[k](o);
      assert.notEqual(row, null, `${k} encodes ${JSON.stringify(o)}`);
      assert.equal(JSON.stringify(ROW_CODECS[k](row)), JSON.stringify(o), `${k}: ${JSON.stringify(row)} reads back key for key`);
    }
  }
  assert.equal(JSON.stringify(Object.keys(ROW_CODECS.$m(ROW_ENCODERS.$m(samples.$m[1])))), JSON.stringify(['ModelId', 'ModelIdNum', 'ObjectType', 'XPos', 'YPos', 'ZPos', 'XScale', 'XRotation', 'YRotation', 'ZRotation']), 'a scale stands before the rotations, as RmbBlock3dObjectRecord writes it');
  assert.deepEqual(ROW_ENCODERS.$m(samples.$m[3]).slice(8), [6, 2, 0.5], 'the scales\' mask (2 Y, 4 Z), then their values');
  assert.deepEqual(ROW_ENCODERS.$f(samples.$f[2]), [], 'a flat\'s trailing zeros are trimmed - all of them');
  assert.deepEqual(ROW_ENCODERS.$t({ TileBitfield: 9, TextureRecord: 4, IsRotated: true, IsFlipped: false }), [9, 4, 1, 0]);
  assert.equal(ROW_ENCODERS.$g({ TextureRecord: 7 }), 7, 'scenery is its one number');
  assert.equal(ROW_CODECS.$b(ROW_ENCODERS.$b({ NameSeed: 1, FactionId: 2, Sector: 3, LocationId: 4, BuildingType: 'House2', Quality: 5 })).BuildingType, 'House2', 'a type the editor wrote by name stays a name (a script wrote 18 - the sha256 keeps them apart)');
  // carried whole: anything a row would not give back exactly
  const m0 = samples.$m[0];
  for (const bad of [{ ...m0, ModelId: '041000' }, { ...m0, Extra: 1 }, { ...m0, XPos: '10' }, { ...m0, XScale: 'big' }, null, [1, 2]]) assert.equal(ROW_ENCODERS.$m(bad), null, JSON.stringify(bad));
  const { Flags, ...noFlags } = samples.$f[0];
  assert.equal(ROW_ENCODERS.$f(noFlags), null, 'a flat without its Flags');
  assert.equal(ROW_ENCODERS.$b({ ...samples.$b[0], BuildingType: null }), null);
  assert.equal(ROW_ENCODERS.$t({ TileBitfield: 1, TextureRecord: 2, IsRotated: 1, IsFlipped: false }), null, 'a tile\'s flags are booleans');
  assert.equal(ROW_ENCODERS.$g({ TextureRecord: 1, Extra: 2 }), null);
  assert.equal(Flags, 0);
});

test('WD3 pack runs: a number array is [value, count, ...] and reads back as the array, an empty one as none', () => {
  let s = 7;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let n = 0; n < 200; n++) {
    const a = Array.from({ length: Math.floor(rnd() * 60) }, () => (rnd() < 0.7 ? 0 : Math.floor(rnd() * 4)));
    const runs = runLength(a);
    assert.equal(runs.length % 2, 0);
    for (let i = 0; i < runs.length; i += 2) assert.ok(runs[i + 1] >= 1 && (i === 0 || runs[i] !== runs[i - 2]), 'maximal runs');
    const pack = { format: PACK_FORMAT, vendor: 't', files: { 'A.json': ['x', ['b', 'TINYAA00.RMB', 7], [['s', ['RmbBlock', 'FldHeader', 'AutoMapData'], { $r: runs }]]] }, nodes: [] };
    assert.deepEqual(openWorldDataPack(pack, { blocks: fakeBlocks(tinyRmb()) }).rebuild('A.json').RmbBlock.FldHeader.AutoMapData, a);
  }
  assert.deepEqual(runLength([]), []);
  assert.deepEqual(runLength([5, 5, 5, 0, 5]), [5, 3, 0, 1, 5, 1]);
});

// ---- the reader ---------------------------------------------------------------------------------------------------------
/** A pack over tinyRmb(7) as the builder would write one, with the file it must rebuild computed independently. */
function tinyPack() {
  const classic = tinyRmb();
  const base = blockToDfuJson(classic);
  const newModels = [ROW_CODECS.$m([42069, 3, 11, -40, 300, 0, 1024, 0]), ROW_CODECS.$m([69424, 3, 12, -60, 310, 0, 0, 0, 1, 0.5])];
  const plainA = [
    ['s', EXT0, newModels],                                                   // the node: a list of rows
    ['s', [...SUB0, 'Interior', 'Block3dObjectRecords'], newModels],          // ...the same node again
    ['s', ['RmbBlock', 'FldHeader', 'AutoMapData', 10], 5], ['s', ['RmbBlock', 'FldHeader', 'AutoMapData', 11], 6], ['s', ['RmbBlock', 'FldHeader', 'AutoMapData', 12], 7],
    ['s', ['RmbBlock', 'Misc3dObjectRecords'], patchJson(base.RmbBlock.SubRecords[0].Exterior.Block3dObjectRecords, [['s', [0, 'XPos'], 99]])],
    ['s', ['RmbBlock', 'FldHeader', 'BuildingDataList', 1, 'BuildingType'], 'House2'],
    ['i', ['RmbBlock', 'MiscFlatObjectRecords', 0], ROW_CODECS.$f([0, 5, -8, 64, 10021, 5])],
    ['d', ['RmbBlock', 'FldHeader', 'OtherNames']],
    ['r', ['RmbBlock', 'SubRecords', 1]],
  ];
  const wantA = patchJson(base, plainA);
  const packedA = [
    ['s', EXT0, { $n: 0 }],
    ['s', [...SUB0, 'Interior', 'Block3dObjectRecords'], { $n: 0 }],
    ['sr', ['RmbBlock', 'FldHeader', 'AutoMapData'], [10, [5, 6, 7]]],
    ['s', ['RmbBlock', 'Misc3dObjectRecords'], { $c: [7, EXT0], $o: [['s', [0, 'XPos'], 99]] }],
    ['s', ['RmbBlock', 'FldHeader', 'BuildingDataList', 1, 'BuildingType'], 'House2'],
    ['i', ['RmbBlock', 'MiscFlatObjectRecords', 0], { $n: 1 }],
    ['d', ['RmbBlock', 'FldHeader', 'OtherNames']],
    ['r', ['RmbBlock', 'SubRecords', 1]],
  ];
  const plainB = [['s', ['Name'], 'TINYAA00.TINYBB00.RMB'], ['s', [...EXT0, 0, 'YRotation'], 1536]];
  const wantB = patchJson(wantA, plainB);
  const wantC = patchJson(base, [['s', ['RmbBlock', 'Misc3dObjectRecords'], base.RmbBlock.SubRecords[0].Exterior.Block3dObjectRecords]]);
  const pack = {
    format: PACK_FORMAT, vendor: 'tiny-towns', mod: { title: 'Tiny Towns', author: 'nobody', version: '0.0.1' },
    files: {
      'TINYAA00.RMB.json': [sha(wantA), ['b', 'TINYAA00.RMB', 7], packedA],
      'TINYAA00.TINYBB00.RMB.json': [sha(wantB), ['f', 'TINYAA00.RMB.json'], plainB],
      'TINYAA00.TINYCC00.RMB.json': [sha(wantC), ['b', 'TINYAA00.RMB', 7], [['s', ['RmbBlock', 'Misc3dObjectRecords'], { $c: [7, EXT0] }]]],
    },
    nodes: [{ $m: [[42069, 3, 11, -40, 300, 0, 1024, 0], [69424, 3, 12, -60, 310, 0, 0, 0, 1, 0.5]] }, ROW_CODECS.$f([0, 5, -8, 64, 10021, 5])],
  };
  return { classic, pack, wantA, wantB, wantC };
}

test('WD3 pack reader: a file is rebuilt from the classic block it names - a node shared by two places, a classic node referenced with the author\'s edits laid on a copy, rows, a run of cells, inserts, deletes, removes - the author\'s file to the byte of its canonical form', () => {
  const { classic, pack, wantA, wantB, wantC } = tinyPack();
  const blocks = fakeBlocks(classic);
  const heard = [];
  const p = openWorldDataPack(pack, { blocks, onRebuilt: (name, json, want) => heard.push([name, sha(json) === want]) });
  assert.equal(p.vendor, 'tiny-towns');
  assert.deepEqual(p.mod, { title: 'Tiny Towns', author: 'nobody', version: '0.0.1' });
  assert.deepEqual(p.names(), ['TINYAA00.RMB.json', 'TINYAA00.TINYBB00.RMB.json', 'TINYAA00.TINYCC00.RMB.json']);
  assert.equal(p.has('TINYAA00.RMB.json'), true); assert.equal(p.has('NOPE.RMB.json'), false);
  assert.equal(p.sha256Of('TINYAA00.RMB.json'), sha(wantA)); assert.equal(p.sha256Of('NOPE.RMB.json'), null);
  assert.deepEqual(p.baseOf('TINYAA00.TINYBB00.RMB.json'), ['f', 'TINYAA00.RMB.json']); assert.equal(p.baseOf('NOPE.RMB.json'), null);
  const a = p.rebuild('TINYAA00.RMB.json');
  assert.equal(canonicalJson(a), canonicalJson(wantA));
  assert.notEqual(a.RmbBlock.SubRecords[0].Exterior.Block3dObjectRecords, a.RmbBlock.SubRecords[0].Interior.Block3dObjectRecords, 'a shared node is laid as a copy in each place');
  assert.equal(a.RmbBlock.Misc3dObjectRecords[0].XPos, 99, 'the classic node with the author\'s edit');
  assert.deepEqual(heard, [['TINYAA00.RMB.json', true]]);
  const c = p.rebuild('TINYAA00.TINYCC00.RMB.json');
  assert.equal(canonicalJson(c), canonicalJson(wantC));
  assert.equal(c.RmbBlock.Misc3dObjectRecords[0].XPos, 10, 'the edit was laid on a copy: the classic node another file references is the classic one');
  heard.pop();
  // a file based on another: the base rebuilt once and kept (pack.bases absent - read off the files)
  const b1 = p.rebuild('TINYAA00.TINYBB00.RMB.json'), b2 = p.rebuild('TINYAA00.TINYBB00.RMB.json');
  assert.equal(canonicalJson(b1), canonicalJson(wantB)); assert.equal(canonicalJson(b2), canonicalJson(wantB));
  assert.deepEqual(heard.map(([n]) => n), ['TINYAA00.RMB.json', 'TINYAA00.TINYBB00.RMB.json', 'TINYAA00.TINYBB00.RMB.json'], 'the base file is kept, not rebuilt for each file on it');
  assert.ok(heard.every(([, ok]) => ok), 'every rebuild is the author\'s sha256');
  assert.equal(blocks.reads.get(7), 1, 'the classic block is read once while its JSON is held');
  p.release();
  p.rebuild('TINYAA00.RMB.json');
  assert.equal(blocks.reads.get(7), 2, 'release lets the classic JSON go');
});

test('WD3 pack reader: the shipped form - every file entry and every node its own JSON text, the base files named up front - rebuilds the same files; serialisePack writes exactly that form', () => {
  const { classic, pack, wantA, wantB, wantC } = tinyPack();
  const shipped = JSON.parse(serialisePack(pack));
  assert.deepEqual(shipped.bases, ['TINYAA00.RMB.json']);
  assert.ok(Object.values(shipped.files).every((e) => typeof e === 'string') && shipped.nodes.every((n) => typeof n === 'string'));
  const p = openWorldDataPack(shipped, { blocks: fakeBlocks(classic) });
  assert.equal(canonicalJson(p.rebuild('TINYAA00.TINYBB00.RMB.json')), canonicalJson(wantB));
  assert.equal(canonicalJson(p.rebuild('TINYAA00.RMB.json')), canonicalJson(wantA));
  assert.equal(canonicalJson(p.rebuild('TINYAA00.TINYCC00.RMB.json')), canonicalJson(wantC));
  assert.equal(p.sha256Of('TINYAA00.RMB.json'), sha(wantA), 'an entry\'s sha256 read off its text');
});

test('WD3 pack reader refuses, by name: a block that is not the one named at its index, a block that does not read, a location MAPS.BSA does not hold or names otherwise, a file the pack has not got, a file with no base or an unknown one, an unknown reference, a node past the list, a classic node that is not there', () => {
  const { classic } = tinyPack();
  const one = (entry, nodes = []) => openWorldDataPack({ format: PACK_FORMAT, vendor: 'v', files: { 'F.json': entry }, nodes }, { blocks: fakeBlocks(classic) });
  const refuses = (p, re, maps = null) => assert.throws(() => p.rebuild('F.json', maps), re);
  refuses(one(['x', ['b', 'OTHER000.RMB', 7], []]), /v wants OTHER000\.RMB at block 7, BLOCKS\.BSA has TINYAA00\.RMB/);
  refuses(one(['x', ['b', null, 8], []]), /block 8 did not read/);
  refuses(one(['x', ['l', 17, 4, 'Daggerfall'], []]), /F\.json: location 17\/4 did not read/, { readClassicLocation: () => null });
  refuses(one(['x', ['l', 17, 4, 'Daggerfall'], []]), /wants Daggerfall at 17\/4, MAPS\.BSA has Sentinel/, { readClassicLocation: () => ({ name: 'Sentinel' }) });
  refuses(one(['x', ['f', 'G.json'], []]), /v has no G\.json/);
  refuses(one(['x', null, []]), /F\.json has no base/);
  refuses(one(['x', ['q', 1], []]), /F\.json: unknown base/);
  refuses(one(['x', ['b', 'TINYAA00.RMB', 7], [['s', ['Name'], { $q: 1 }]]]), /unknown reference \$q/);
  refuses(one(['x', ['b', 'TINYAA00.RMB', 7], [['s', ['Name'], { $n: 1 }]]], [{ a: 1 }]), /no node 1/);
  refuses(one(['x', ['b', 'TINYAA00.RMB', 7], [['s', ['Name'], { $c: [7, ['RmbBlock', 'Nowhere']] }]]]), /classic node \[7,\["RmbBlock","Nowhere"\]\] not found/);
  refuses(one(['x', ['b', 'TINYAA00.RMB', 7], [['s', ['RmbBlock', 'SubRecords', 5], 1]]]), /set past the end/);
  assert.throws(() => openWorldDataPack({ format: PACK_FORMAT, vendor: 'v', files: {}, nodes: [] }, { blocks: fakeBlocks(classic) }).rebuild('F.json'), /v has no F\.json/);
});

// ---- the bytes ----------------------------------------------------------------------------------------------------------
test('WD3 pack bytes: readPackText inflates a gzipped pack and passes a server\'s already-inflated text through; packFileSha256 is the canonical form\'s sha256 - WD1\'s hash, the builder\'s hash', async () => {
  const text = JSON.stringify({ format: PACK_FORMAT, b: [1, 2, 3], s: 'Gänsefleisch' });
  assert.equal(await readPackText(new Uint8Array(zlib.gzipSync(Buffer.from(text)))), text);
  assert.equal(await readPackText(new TextEncoder().encode(text)), text, 'Vite\'s dev server answers a .gz with Content-Encoding: gzip - the bytes come inflated');
  const json = { b: [1, { z: 1, a: 2 }], a: 'x' };
  const want = createHash('sha256').update(canonicalJson(json)).digest('hex');
  assert.equal(await packFileSha256(json), want);
  assert.equal(await canonicalSha256(json), want, 'one canonical form for WD1 and WD3');
  assert.equal(await packFileSha256({ a: 'x', b: [1, { a: 2, z: 1 }] }), want, 'key order is no part of a file\'s identity');
});

test('WD3 builder: FullSerializer\'s own escapes (\\0, \\a) read as the characters they name, inside strings only; a bundle TextAsset is looked up by DFU\'s name for it, and an editor leftover by none', () => {
  assert.deepEqual(parseFullSerializerJson('{"Name":"A\\0B\\aC","N":"\\\\0"}'), { Name: 'A\u0000B\u0007C', N: '\\0' });
  assert.deepEqual(parseFullSerializerJson('{"x":[1,2]}'), { x: [1, 2] });
  assert.equal(dfuWorldDataName('assets/game/mods/x/worlddata/Location-17-958.json'), 'location-17-958.json');
  assert.equal(dfuWorldDataName('Assets/WorldData/fighbm00.rmb.json'), 'FIGHBM00.RMB.json');
  assert.equal(dfuWorldDataName('Assets/WorldData/WALLAA04.FARMBA01.RMB.json'), 'WALLAA04.FARMBA01.RMB.json');
  assert.equal(dfuWorldDataName('Assets/WorldData/objectgroup.json'), null);
  assert.equal(dfuWorldDataName('Assets/WorldData/temple stairs - straight.json'), null);
});

// ---- the vendored packs ---------------------------------------------------------------------------------------------------
test('WD3 a pack\'s classic references are checked BY NAME (AUDIT WD3 P5) - `classicNames` names the block each `$c` reads, as a `b` base names its own: a BLOCKS.BSA in another order refuses the file (the classic stands) where it read another block\'s pieces', () => {
  const ref = { $c: [7, ['RmbBlock', 'FldHeader', 'BuildingDataList', 0]] };
  const make = (classicNames) => ({ format: PACK_FORMAT, vendor: 't', ...(classicNames ? { classicNames } : {}), files: { 'A.json': ['x', ['b', 'TINYAA00.RMB', 7], [['s', ['RmbBlock', 'FldHeader', 'BuildingDataList', 1], ref]]] }, nodes: [] });
  assert.deepEqual(classicIndicesOf(make(null)), [7]);
  const read = (names) => openWorldDataPack(make(names), { blocks: fakeBlocks(tinyRmb()) }).rebuild('A.json').RmbBlock.FldHeader.BuildingDataList[1].NameSeed;
  assert.equal(read({ 7: 'TINYAA00.RMB' }), 101, 'the named block read');
  assert.equal(read(null), 101, 'a pack from before the names reads as it did');
  assert.throws(() => read({ 7: 'OTHRAA00.RMB' }), /wants OTHRAA00\.RMB at block 7, BLOCKS\.BSA has TINYAA00\.RMB/, 'another block at the index: refused');
  assert.match(readFileSync(join(ROOT, 'tools/worldDataPackBuild.mjs'), 'utf8'), /out\.classicNames = Object\.fromEntries\(classicIndicesOf\(out\)\.map\(\(i\) => \[i, blocks\.getBlockName\(i\)\]\)\);/, 'the builder names them');
});
