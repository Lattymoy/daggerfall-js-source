// ARENA1 (2026-10-02): KAMER'S DAGGERFALL ARENA 1.0, AS THE PORT CARRIES IT (vendor/daggerfall-arena/). The files
// are the extraction tool's (tools/daggerfallArenaExtract.mjs; test/arena1_extract.test.js re-runs it on the bundle);
// these pins hold what the files SAY - the manifest's words, the listing, no picture, the model's shape and table,
// the block's contents and none of ZLNDFLAT's leftovers, the undercroft's 32 blocks - with no game data needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodeArenaModel } from '../src/world/arenaModel.js';
import { arenaBlockJson, ARENA_GATE_PEOPLE, ARENA_BLOCK, UNDERCROFT_LOCATION_ID } from '../src/world/arenaCity.js';
import { NPC_FLAT_ARCHIVES } from '../src/world/rdbLayout.js';
import { lenientJson, jsonRows } from '../tools/daggerfallArenaExtract.mjs';

const PIECE_SET = [62209, 63000, 63004, 63007, 63024, 63028, 63035, 72006];
const DIR = new URL('../vendor/daggerfall-arena/', import.meta.url).pathname;
const read = (rel) => readFileSync(join(DIR, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const walk = (d, pre = '') => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n), `${pre}${n}/`) : [`${pre}${n}`]));

test('ARENA1 vendor: the manifest is Kamer\'s, verbatim - title, version, author, GUID, the four files his bundle lists', () => {
  const m = json('daggerfallarena.dfmod.json');
  assert.equal(m.ModTitle, 'Daggerfall Arena');
  assert.equal(m.ModVersion, '1.0');
  assert.equal(m.ModAuthor, 'Kamer');
  assert.equal(m.ContactInfo, 'DFU Discord');
  assert.equal(m.GUID, '0a802a1a-5e27-4266-84ee-8625ebf50d9d');
  assert.equal(m.ModDescription, 'Adds an Arena North of Daggerfall');
  assert.equal(m.Files.length, 4);
  assert.match(read('daggerfallarena.dfmod.json'), /\r\n/, 'the bundle\'s own bytes, CRLF and all - not a re-serialised copy');
});

test('ARENA1 vendor: the tool\'s listing is the directory, and no picture stands in it (the bundle\'s two are Daggerfall\'s own)', () => {
  const listing = json('daggerfall-arena.files.json');
  assert.equal(listing.ModAuthor, 'Kamer');
  assert.match(listing.BundleSha256, /^[0-9a-f]{64}$/);
  const files = walk(DIR).filter((f) => f !== 'README.md' && f !== 'daggerfall-arena.files.json').sort();
  assert.deepEqual(files, [...listing.Files].sort());
  assert.deepEqual(walk(DIR).filter((f) => /\.(png|tga|dds|jpe?g|bmp|psd)$/i.test(f)), [], 'no texture is carried');
  const readme = read('README.md');
  assert.match(readme, /Kamer/);
  assert.match(readme, /granted by the author, relayed by Mac 2026-10-02/i);
  assert.match(readme, /node tools\/daggerfallArenaExtract\.mjs/);
  assert.match(readme, new RegExp(`\\*\\*${json('Models/864102.json').pieces.length} pieces\\*\\*`), 'the README counts the pieces the model carries (AUDIT PRE-MERGE 1003 D11: it said 25)');
});

test('ARENA1 vendor: the model - 23 slots in RuntimeMaterials\' table, climate-free, Kamer\'s triangles and 18 pieces making the 5,138', () => {
  const idx = json('Models/864102.json');
  assert.equal(idx.model, 864102);
  assert.equal(idx.mesh, 'Castle');
  assert.deepEqual(idx.submeshes.map((s) => [s.archive, s.record]), [[94, 3], [174, 2], [109, 1], [109, 3], [69, 3], [109, 4], [171, 3], [171, 4], [109, 2], [109, 0],
    [321, 1], [122, 1], [122, 2], [122, 3], [122, 4], [321, 2], [321, 0], [67, 14], [124, 0], [124, 2], [124, 3], [31, 0], [350, 3]]);
  assert.deepEqual(idx.collider, { mesh: 'Castle', sameAsDrawn: true, convex: false, isTrigger: false, enabled: true, cookingOptions: 30 });
  assert.equal(idx.source.triangles, 5138);
  assert.equal(idx.source.vertices, 9034);
  const own = idx.submeshes.reduce((a, s) => a + s.count / 3, 0);
  assert.equal(own, 4773, 'Kamer\'s own triangles');
  assert.equal(idx.pieces.length, 18);
  assert.deepEqual([...new Set(idx.pieces.map((p) => p.model))].sort((x, y) => x - y), PIECE_SET);
  for (const p of idx.pieces) {
    assert.ok(p.turn >= 0 && p.turn < 8 && p.at.length === 3, `${p.model}: a turn and a place`);
    assert.ok(p.keep === 'all' || (Array.isArray(p.keep) && p.keep.length > 0), `${p.model}: the triangles it keeps`);
    assert.ok(p.at[1] > -4.44 && p.at[1] < -4.42, 'every piece on the undercroft\'s floor, y -4.432');
  }
  // sizes against the binary
  const bin = new Uint8Array(readFileSync(join(DIR, 'Models/864102.bin')));
  const a = idx.attributes;
  assert.equal(a.normal.offset - a.position.offset, idx.vertexCount * 12);
  assert.equal((a.indices.offset + a.indices.count * 2 + 3) & ~3, bin.length, 'the indices end the file (padded to four)');
  assert.equal(a.indices.count, own * 3);
});

test('ARENA1 vendor: the binary decodes to a sound mesh in the block - indices in range, unit normals, the footprint 3,396 x 3,712 units', () => {
  const idx = json('Models/864102.json');
  const m = decodeArenaModel(idx, new Uint8Array(readFileSync(join(DIR, 'Models/864102.bin'))));
  const n = m.positions.length / 3;
  assert.equal(n, idx.vertexCount);
  assert.ok(m.indices.every((i) => i < n));
  for (let i = 0; i < n; i += 97) assert.ok(Math.abs(Math.hypot(m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]) - 1) < 0.01, `normal ${i}`);
  assert.equal(m.subMeshes.length, idx.submeshes.filter((x) => x.count > 0).length, 'a slot the pieces took whole (122_1) draws nothing of Kamer\'s');
  assert.equal(m.subMeshes.length, 22);
  assert.equal(m.doors.length, 0, 'a custom prefab gets no door - DOOR is decoration');
  const { min, max } = idx.source.bounds;
  assert.equal(Math.round((max[0] - min[0]) / 0.025), 3396);
  assert.equal(Math.round((max[2] - min[2]) / 0.025), 3712);
  // the placement keeps it inside its 4,096-unit cell
  const blk = json('Arena/ARENADAG.RMB.json');
  const rec = blk.RmbBlock.Misc3dObjectRecords.find((r) => r.ModelIdNum === 864102);
  const x0 = rec.XPos + min[0] / 0.025, x1 = rec.XPos + max[0] / 0.025, z0 = rec.ZPos + 4096 + min[2] / 0.025, z1 = rec.ZPos + 4096 + max[2] / 0.025;
  assert.ok(x0 > 0 && x1 < 4096 && z0 > 0 && z1 < 4096, `the colosseum stands inside the cell: x ${x0}..${x1}, z ${z0}..${z1}`);
});

test('ARENA1 vendor: ARENADAG.RMB - DFARENA\'s 119 models (the colosseum, the 43600 stair) and 29 lights, no building, no ZLNDFLAT leftover', () => {
  const blk = json('Arena/ARENADAG.RMB.json');
  assert.equal(blk.Name, ARENA_BLOCK);
  assert.equal(blk.RmbBlock.FldHeader.Name, ARENA_BLOCK);
  assert.deepEqual(blk.RmbBlock.SubRecords, []);
  assert.deepEqual(blk.RmbBlock.FldHeader.BuildingDataList, []);
  for (const k of ['OtherNames', 'BlockPositions', 'BlockDataSizes', 'NumBlockDataRecords']) assert.ok(!(k in blk.RmbBlock.FldHeader), `${k} is ZLNDFLAT's`);
  assert.ok(!('Index' in blk) && !('Position' in blk));
  const models = blk.RmbBlock.Misc3dObjectRecords;
  assert.equal(models.length, 119);
  assert.equal(models.filter((m) => m.ModelIdNum === 864102).length, 1);
  assert.deepEqual(models.filter((m) => m.ModelIdNum === 43600).map((m) => [m.XPos, m.YPos, m.ZPos, m.YRotation]), [[848, -36, -1504, -1024]], 'the stair down');
  const flats = blk.RmbBlock.MiscFlatObjectRecords;
  assert.equal(flats.length, 29);
  assert.ok(flats.every((f) => f.TextureArchive === 210 && f.FactionID === 0), 'lights only');
  assert.equal(blk.RmbBlock.FldHeader.AutoMapData.length, 4096);
  assert.equal(blk.RmbBlock.FldHeader.AutoMapData.filter((v) => v === 117).length, 2513, 'the bowl on the automap');
  assert.equal(blk.RmbBlock.FldHeader.GroundData.GroundTiles.length, 256);
});

test('ARENA1 vendor: the block served stands the gate\'s six people, each in a person archive with a faction - the Herald first', () => {
  const served = arenaBlockJson();
  const people = served.RmbBlock.MiscFlatObjectRecords.slice(29, 35);   // ARENA-FIX 3: the plazas' flats follow them
  assert.equal(people.length, 6);
  assert.deepEqual(ARENA_GATE_PEOPLE.map((p) => p.role), ['herald', 'warden', 'warden', 'redRecruiter', 'blueRecruiter', 'bookmaker']);
  for (const p of people) {
    assert.ok(NPC_FLAT_ARCHIVES.includes(p.TextureArchive), `${p.TextureArchive}: the ray meets a person`);
    assert.ok(p.FactionID > 0, 'RMBLayout stands a street person only with a faction');
    assert.ok(p.ZPos > -299 && p.ZPos < 0, 'outside the north arch (the colosseum ends at -299), inside the block');
  }
  assert.equal(new Set(people.map((p) => p.Position)).size, 6, 'each its own identity');
  assert.equal(json('Arena/ARENADAG.RMB.json').RmbBlock.MiscFlatObjectRecords.length, 29, 'the vendored file is Kamer\'s alone');
});

test('ARENA1 vendor: the undercroft - Kamer\'s 32 blocks, one start (N0000077), location id 55398', () => {
  const u = json('Arena/undercroft.json');
  assert.equal(u.Name, 'Arena of Daggerfall');
  assert.equal(u.LocationId, UNDERCROFT_LOCATION_ID);
  assert.equal(u.Blocks.length, 32);
  assert.deepEqual(u.Blocks.filter((b) => b.IsStartingBlock).map((b) => b.BlockName), ['N0000077.RDB']);
  assert.equal(u.Blocks.filter((b) => b.BlockName.startsWith('B')).length, 18, 'border blocks');
  assert.equal(new Set(u.Blocks.map((b) => `${b.X},${b.Z}`)).size, 32, 'no two on one spot');
});

test('ARENA1 tool: the mod\'s location is read as DFU reads it (a trailing comma is no element), and rows stay one a line', () => {
  assert.deepEqual(lenientJson('{"a": ["x",\n ], "b": {"c": 1,}}'), { a: ['x'], b: { c: 1 } });
  assert.throws(() => JSON.parse('["x",]'));
  assert.equal(jsonRows({ a: 1, b: [{ x: 1 }, { x: 2 }] }), '{\n "a": 1,\n "b": [\n  {"x":1},\n  {"x":2}\n ]\n}\n');
});
