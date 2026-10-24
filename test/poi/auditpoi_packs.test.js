// AUDIT POI, LANE G (2026-10-15; bible/06-Systems/POI-Editor-Arc.md POI-4b, POI-6) - PACKS, THE DIFF, THE SHELF ENTRY.
// Mac: "Audit everything. Ensure perfection." What the audit of the POI arc found in its packs, its approver's diff and
// its library entry, each pinned red on the code it found and green on the fix:
//   - P1 a turn read against itself (src/poi/poiDiff.js quatAngleDeg: the quaternions taken as unit ones);
//   - P12 a part's move read in its POI's frame, not the world's; T2 every change the diff names, each asked;
//   - P2 a pack written that would not open again; P3 a pack read whole the store then refused halfway; P7 an id twice;
//     P10 a pack's folder zipped; P11 a file nothing names kept and uploaded; T1 every refusal the pack promises
//     (src/poi/poiPack.js);
//   - P4 a library entry put over another builder's, or copied again at every import (src/poi/poiTransfer.js
//     importPack) - on a fake store and on the real Worker;
//   - P5 a pack's zip inflated whole before anything was asked (poiPack.js readPackBytes, scenes/dataSource.js
//     readZipEntries' `limit`);
//   - T3 an entry made from parts that are not the defaults (src/poi/poiShelf.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { poiDiff, quatAngleDeg } from '../../src/poi/poiDiff.js';
import { packErrorText } from '../../src/poi/poiText.js';
import { writePack, readPack, readPackBytes, packRoot, POI_PACK_LIMITS } from '../../src/poi/poiPack.js';
import { exportModel, exportPack, importPack, copyIdOf } from '../../src/poi/poiTransfer.js';
import { shelfEntryOf, putOnShelf } from '../../src/poi/poiShelf.js';
import { readZipEntries } from '../../src/scenes/dataSource.js';
import { zipStore } from '../../src/systems/save/saveTransfer.js';
import { encodePoiMesh, POI_MESH_LIMITS } from '../../src/poi/poiMesh.js';
import { DEFAULT_MATERIAL, poiDocProblems, poiShelfProblems } from '../../src/poi/poiLaw.js';
import { quatOfEuler } from '../../src/poi/poiEdit.js';
import { quatAngleAxis } from '../../src/world/quat.js';
import { readGltf } from '../../src/poi/gltfImport.js';
import { standService } from '../accountDb.mjs';
import { forgetPoiFeed } from '../../server-account/src/poi.js';
import { poiPutAsset, poiHistory, poiShelve, poiShelf, poiShelfEntry } from '../../src/poi/poiService.js';

const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));
/** A triangle, one submesh - one material. */
const TRI = { positions: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]), normals: Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1]), uvs: Float32Array.from([0, 0, 1, 0, 0, 1]), indices: Uint16Array.from([0, 1, 2]), submeshes: [{ start: 0, count: 3 }] };
const place = (extra = {}) => ({ px: 200, py: 210, x: 100, z: 200, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1, ...extra });
const part = (key, mesh, extra = {}) => ({ key, name: key, mesh, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true, materials: [{ ...DEFAULT_MATERIAL }], ...extra });
const docOf = (id, extra = {}) => ({ v: 1, id, name: 'Shrine', place: place(), parts: [part('altar', 'a'.repeat(64))], lights: [], marker: { show: false }, ...extra });
const entryOf = (id, extra = {}) => ({ v: 1, id, name: 'Well', parts: [part('well', 'a'.repeat(64))], lights: [], thumb: null, ...extra });
const fakeSha = (n) => n.toString(16).padStart(64, '0');
const asBytes = (b) => ({ arrayBuffer: async () => b.slice().buffer });

/** A zip as an archiver might write it: each entry stored (method 0) or deflated (8), its declared size as given - the
 *  reader trusts none of it. */
function zipOf(entries) {
  const enc = new TextEncoder(), parts = [], cds = [];
  const u16 = (v) => [v & 255, (v >> 8) & 255], u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  let off = 0;
  for (const { name, data, method = 0, size = data.length } of entries) {
    const n = enc.encode(name);
    const local = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(method), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(size), ...u16(n.length), ...u16(0), ...n]);
    parts.push(local, data);
    cds.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(method), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(size), ...u16(n.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off), ...n]));
    off += local.length + data.length;
  }
  const cdSize = cds.reduce((a, c) => a + c.length, 0);
  const eocd = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  const all = [...parts, ...cds, eocd], out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
  let p = 0;
  for (const x of all) { out.set(x, p); p += x.length; }
  return out;
}
const deflated = (name, data) => ({ name, data: deflateRawSync(data), method: 8, size: data.length });
const headOf = (pois = [], shelf = []) => new TextEncoder().encode(JSON.stringify({ v: 1, kind: 'poi-pack', pois, shelf }));
/** Bytes no inflater takes: an entry whose bytes are these is never inflated, or the read throws. */
const NOT_DEFLATE = Uint8Array.from([0xff, 0xff, 0xff, 0xff]);

async function tri() {
  const bytes = encodePoiMesh(TRI);
  return { bytes, sha: await sha256(bytes) };
}

// ── THE DIFF ────────────────────────────────────────────────────────

test('AUDIT POI P1 A TURN AGAINST ITSELF: every quaternion the editor writes (tidied to a millionth, so never quite of unit length) reads as no turn against itself, and one the law takes at a length of 0.9995 too - an untouched POI said "Turned 0.2°" and its part "turned"; a turn between quaternions of other lengths is the turn (mutant: the dot product read as a cosine)', () => {
  let worst = 0, n = 0;
  for (let a = 0; a < 360; a += 7) for (let b = 0; b < 360; b += 11) { const q = quatOfEuler([a % 90, b, (a * 3) % 360]); worst = Math.max(worst, quatAngleDeg(q, q)); n++; }
  assert.equal(n, 1716);
  assert.ok(worst < 1e-6, `a tidied turn against itself reads ${worst} degrees`);
  // the audit's own: |q|^2 = 0.99999856, read as 0.19 degrees
  const tidied = [0.416149, 0.444698, -0.689143, 0.392612];
  const doc = docOf('poi-00000000beef', { place: place({ r: tidied }), parts: [part('tower', 'a'.repeat(64), { r: tidied })] });
  assert.deepEqual(poiDocProblems(doc), []);
  assert.deepEqual(poiDiff(doc, structuredClone(doc)), [], 'an identical document changes nothing');
  // a length the law takes (within a thousandth of one)
  const k = 0.9995, short = [0, Math.sin(0.3) * k, 0, Math.cos(0.3) * k];
  const doc2 = docOf('poi-00000000beef', { place: place({ r: short }), parts: [part('tower', 'a'.repeat(64), { r: short })] });
  assert.deepEqual(poiDocProblems(doc2), []);
  assert.deepEqual(poiDiff(doc2, structuredClone(doc2)), []);
  // the turn between two lengths is the turn between them
  assert.ok(Math.abs(quatAngleDeg(short, [0, 0, 0, 1]) - 34.3775) < 1e-3);
  assert.ok(Math.abs(quatAngleDeg(quatAngleAxis(30, [0, 1, 0]).map((c) => c * 1.0008), quatAngleAxis(60, [0, 1, 0])) - 30) < 1e-9);
  assert.ok(Math.abs(quatAngleDeg(quatAngleAxis(179, [1, 0, 0]), [0, 0, 0, 1]) - 179) < 1e-9);
});

test('AUDIT POI T2 + P12 WHAT IT CHANGES, EVERY WAY: a part turned, resized and shrunk, made not solid, its shadow off; the words and the tags; the POI shrunk; moved over a pixel\'s edge east and north, and in height; a part moved 0.4 m in the world under a size of 100 (mutants: each dropped; the pixel ignored; the north read south; the height ignored; a shrink read as none; the part\'s move read in its frame)', () => {
  const before = docOf('poi-00000000beef', { place: place({ s: 2 }), about: 'Old.', tags: ['stone'], parts: [part('tower', 'a'.repeat(64)), part('door', 'b'.repeat(64)), part('gate', 'c'.repeat(64)), part('flag', 'd'.repeat(64))] });
  const after = structuredClone(before);
  after.parts[0].r = quatAngleAxis(20, [0, 1, 0]);
  after.parts[1].s = [0.5, 1, 1];
  after.parts[2].collide = 'none';
  after.parts[3].shadow = false;
  after.about = 'Older.';
  after.tags = ['stone', 'ruin'];
  after.place.s = 1;
  const d = poiDiff(before, after);
  assert.deepEqual(d.map((c) => c.code), ['about', 'tags', 'sized', 'part-changed', 'part-changed', 'part-changed', 'part-changed']);
  assert.deepEqual(d.find((c) => c.code === 'tags').tags, ['stone', 'ruin']);   // PIN MOVED (AUDIT POI, the lead's join): the tags themselves, listed in the reader's language by diffText
  assert.deepEqual([d.find((c) => c.code === 'sized').from, d.find((c) => c.code === 'sized').to], [2, 1], 'shrunk');
  assert.deepEqual(d.filter((c) => c.code === 'part-changed').map((c) => [c.name, c.what]), [['tower', ['turned']], ['door', ['sized']], ['gate', ['solidity']], ['flag', ['solidity']]]);
  // a part grown on one side and shrunk on another
  assert.deepEqual(poiDiff(before, { ...before, parts: [{ ...before.parts[0], s: [1, 1, 0.999] }, ...before.parts.slice(1)] }).map((c) => c.what), [['sized']]);
  // moved over the pixel's east edge: 818.2 m into pixel 200, 0.8 m into 201 - 1.8 m, not 817.4
  const moved = (p0, p1) => poiDiff({ ...before, place: place(p0) }, { ...before, place: place(p1) });
  assert.deepEqual(moved({ px: 200, x: 818.2 }, { px: 201, x: 0.8 }), [{ code: 'moved', m: 1.8 }]);
  // over its north edge: the next pixel north is py - 1, its z from that pixel's south edge
  assert.deepEqual(moved({ py: 210, z: 818.2 }, { py: 209, z: 1 }), [{ code: 'moved', m: 2 }]);
  // in height alone
  assert.deepEqual(moved({ y: 0 }, { y: 3 }), [{ code: 'moved', m: 3 }]);
  // P12: a POI of size 100 - a part's offset moved 4 mm in its frame is 0.4 m in the world
  const big = docOf('poi-00000000beef', { place: place({ s: 100 }) });
  const nudged = structuredClone(big);
  nudged.parts[0].t = [0.004, 0, 0];
  assert.deepEqual(poiDiff(big, nudged), [{ code: 'part-changed', name: 'altar', what: ['moved'] }], 'a 0.4 m move in the world');
  // and at size 1, 4 mm is under the bound
  assert.deepEqual(poiDiff({ ...big, place: place() }, { ...nudged, place: place() }), []);
});

// ── A PACK WRITTEN ──────────────────────────────────────────────────

test('AUDIT POI P2 A PACK NEVER WRITTEN THAT WILL NOT OPEN: the export holds every document to the law before it fetches a byte, and names the one that falls short (one just made, no part yet); the writer asks the same law, each id once, what they wear against the bytes, an asset that is no mesh or picture, and the pack\'s bounds - its documents, its files, its bytes (mutants: the export unasked; the writer unasked; what they wear unasked; the files unbounded; the bytes unbounded)', async () => {
  const { bytes, sha } = await tri();
  const shrine = docOf('poi-00000000beef', { parts: [part('altar', sha)] });
  const empty = docOf('poi-00000000f00d', { name: 'New place', parts: [] });
  const asked = [];
  const r = await exportPack({ pois: [shrine, empty] }, async (h) => { asked.push(h); return bytes; });
  assert.equal(r.ok, false);
  assert.deepEqual([r.code, r.index, r.name, r.problem], ['pack-bad-poi', 1, 'New place', { path: 'parts', code: 'parts-none' }]);
  assert.deepEqual(r.problems, [{ path: 'parts', code: 'parts-none' }]);
  assert.deepEqual(asked, [], 'nothing fetched for a pack the law refuses');
  assert.equal(packErrorText(r), 'A POI in the pack is not valid (New place).');
  // the writer itself
  const assets = new Map([[sha, bytes]]);
  assert.equal(writePack({ pois: [shrine, empty], assets }).code, 'pack-bad-poi');
  assert.equal(writePack({ shelf: [entryOf('lib-00000000cafe', { name: '' })], assets }).code, 'pack-bad-entry');
  assert.deepEqual(writePack({ pois: [shrine, { ...shrine, name: 'Shrine again' }], assets }), { ok: false, code: 'pack-poi-twice', index: 1, id: shrine.id, name: 'Shrine again' });
  // what they wear: three materials over a one-submesh mesh
  const wrong = docOf('poi-00000000beef', { parts: [part('altar', sha, { materials: [{ ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }] })] });
  const w = writePack({ pois: [wrong], assets });
  assert.deepEqual([w.code, w.problem], ['pack-bad-poi', { path: 'parts[0].materials', code: 'material-count', have: 3, want: 1 }]);
  assert.equal((await exportPack({ pois: [wrong] }, async () => bytes)).code, 'pack-bad-poi', 'the export the same');
  // a mesh named, bytes that are neither a mesh nor a picture
  assert.deepEqual(writePack({ pois: [shrine], assets: new Map([[sha, new Uint8Array(64)]]) }), { ok: false, code: 'pack-asset-bad', sha });
  // the bounds: documents and entries by count
  const many = Array.from({ length: POI_PACK_LIMITS.pois + 1 }, (_, i) => docOf(`poi-${i.toString(16).padStart(12, '0')}`, { parts: [part('altar', sha)] }));
  assert.deepEqual(writePack({ pois: many, assets }), { ok: false, code: 'pack-too-large' });
  assert.deepEqual(await exportPack({ pois: many }, async () => bytes), { ok: false, code: 'pack-too-large' });
  assert.deepEqual(writePack({ shelf: Array.from({ length: POI_PACK_LIMITS.shelf + 1 }, (_, i) => entryOf(`lib-${i.toString(16).padStart(12, '0')}`)), assets }), { ok: false, code: 'pack-too-large' });
  // its files: more assets named than a pack may carry
  const parts128 = (base) => Array.from({ length: 128 }, (_, i) => part(`p${i}`, fakeSha(base + i)));
  const crowd = Array.from({ length: Math.ceil(POI_PACK_LIMITS.files / 128) }, (_, i) => docOf(`poi-${i.toString(16).padStart(12, '0')}`, { parts: parts128(i * 128) }));
  assert.deepEqual(writePack({ pois: crowd, assets: new Map() }), { ok: false, code: 'pack-too-large' }, 'counted before any is looked for');
  // its bytes: sixty-five pictures of 16 MiB are past the gigabyte a pack may hold
  const big = new Uint8Array(16 * 1024 * 1024);
  const heavy = docOf('poi-00000000beef', { parts: Array.from({ length: 65 }, (_, i) => part(`p${i}`, fakeSha(i))) });
  assert.deepEqual(writePack({ pois: [heavy], assets: new Map(Array.from({ length: 65 }, (_, i) => [fakeSha(i), big])) }), { ok: false, code: 'pack-too-large' });
  // and a good one is written, and reads back
  const good = writePack({ pois: [shrine], assets });
  assert.equal(good.ok, true);
  assert.equal((await readPackBytes(good.bytes)).ok, true);
});

// ── A PACK READ ─────────────────────────────────────────────────────

test('AUDIT POI P3 + P7 + P11 + T1 A PACK READ, EVERY REFUSAL: what each document and entry wears against the pack\'s own assets (the store refused a library entry halfway, after the assets and the entries before it were stored); an id twice; a missing mesh; a picture where a mesh belongs and a mesh where a picture does; a library entry short of the law; a picture that is no picture; its documents, entries and files counted; a file nothing names neither read nor kept (mutants: what they wear unasked; an id twice taken; the mesh unchecked; the kind unchecked; the entry\'s law unasked; the picture unread; each count unbounded; a file nothing names kept)', async () => {
  const { bytes, sha } = await tri(), pic = await sha256(PNG);
  const files = (head, extra = []) => [{ name: 'pack.json', data: head }, { name: `assets/${sha}.mesh`, data: bytes }, { name: `assets/${pic}.png`, data: PNG }, ...extra];
  const good = docOf('poi-00000000beef', { parts: [part('altar', sha)] });
  const well = entryOf('lib-00000000cafe', { parts: [part('well', sha)], thumb: pic });
  assert.equal((await readPack(files(headOf([good], [well])))).ok, true);
  // P3: an entry wearing three materials over a one-submesh mesh - the store's shelve would refuse it
  const three = [{ ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }];
  const badEntry = entryOf('lib-00000000bbbb', { name: 'Wrong count', parts: [part('well', sha, { materials: three })] });
  assert.deepEqual(poiShelfProblems(badEntry), [], 'its own shape is the law\'s');
  const e = await readPack(files(headOf([], [well, badEntry])));
  assert.deepEqual([e.ok, e.code, e.index, e.name, e.problem], [false, 'pack-bad-entry', 1, 'Wrong count', { path: 'parts[0].materials', code: 'material-count', have: 3, want: 1 }]);
  assert.deepEqual(e.problems, [e.problem]);
  const p = await readPack(files(headOf([docOf('poi-00000000beef', { parts: [part('altar', sha, { materials: three })] })])));
  assert.deepEqual([p.code, p.problem.code], ['pack-bad-poi', 'material-count']);
  // P7: an id twice
  assert.deepEqual(await readPack(files(headOf([good, { ...good, name: 'Shrine (2)' }]))), { ok: false, code: 'pack-poi-twice', index: 1, id: good.id, name: 'Shrine (2)' });
  const twice = await readPack(files(headOf([], [well, { ...well, name: 'Well (2)' }])));
  assert.deepEqual([twice.code, twice.id], ['pack-entry-twice', well.id]);
  assert.equal(packErrorText(twice), 'The pack holds two library entries under one id (Well (2)).');
  assert.equal(packErrorText({ code: 'pack-poi-twice', name: 'Shrine (2)' }), 'The pack holds two POIs under one id (Shrine (2)).');
  // T1: a mesh it does not carry
  assert.deepEqual(await readPack(files(headOf([good])).filter((f) => !f.name.endsWith('.mesh'))), { ok: false, code: 'pack-missing-asset', sha, name: 'Shrine' });
  // a picture where a mesh belongs, a mesh where a picture does
  assert.deepEqual(await readPack(files(headOf([docOf('poi-00000000beef', { parts: [part('altar', pic)] })]))), { ok: false, code: 'pack-missing-asset', sha: pic, name: 'Shrine' });
  const meshAsPicture = docOf('poi-00000000beef', { parts: [part('altar', sha, { materials: [{ ...DEFAULT_MATERIAL, texture: sha }] })] });
  assert.deepEqual(await readPack(files(headOf([meshAsPicture]))), { ok: false, code: 'pack-missing-asset', sha, name: 'Shrine' });
  // a library entry short of the law
  const nameless = await readPack(files(headOf([], [{ ...well, name: '' }])));
  assert.deepEqual([nameless.code, nameless.problem.code], ['pack-bad-entry', 'name']);
  // a picture that is no picture, named by a document as a picture
  const junk = new Uint8Array(40).fill(7), junkSha = await sha256(junk);
  const wearsJunk = docOf('poi-00000000beef', { parts: [part('altar', sha, { materials: [{ ...DEFAULT_MATERIAL, texture: junkSha }] })] });
  assert.deepEqual(await readPack(files(headOf([wearsJunk]), [{ name: `assets/${junkSha}.png`, data: junk }])), { ok: false, code: 'pack-asset-bad', sha: junkSha });
  // the counts
  const many = Array.from({ length: POI_PACK_LIMITS.pois + 1 }, (_, i) => docOf(`poi-${i.toString(16).padStart(12, '0')}`, { parts: [part('altar', sha)] }));
  assert.deepEqual(await readPack(files(headOf(many))), { ok: false, code: 'pack-too-large' });
  const shelfMany = Array.from({ length: POI_PACK_LIMITS.shelf + 1 }, (_, i) => entryOf(`lib-${i.toString(16).padStart(12, '0')}`, { parts: [part('well', sha)] }));
  assert.deepEqual(await readPack(files(headOf([], shelfMany))), { ok: false, code: 'pack-too-large' });
  const crowd = files(headOf([good]), Array.from({ length: POI_PACK_LIMITS.files }, (_, i) => ({ name: `readme-${i}.txt`, data: new Uint8Array(0) })));
  assert.deepEqual(await readPack(crowd), { ok: false, code: 'pack-too-large' });
  // P11: a file nothing names - here a damaged one - is neither read nor kept
  const r = await readPack(files(headOf([good]), [{ name: `assets/${junkSha}.mesh`, data: junk }]));
  assert.equal(r.ok, true);
  assert.deepEqual([...r.assets.keys()], [sha], 'only what the document wears');
});

test('AUDIT POI P10 A PACK\'S FOLDER ZIPPED: a pack unzipped and its folder zipped again (Finder, Explorer) - every file under one folder, a Mac\'s __MACOSX shadows beside - opens as the pack; files under two folders are no pack (mutants: the folder not stripped; the shadows read as files)', async () => {
  const { bytes, sha } = await tri();
  const doc = docOf('poi-00000000beef', { parts: [part('altar', sha)] });
  const zipped = (prefix, extra = []) => zipOf([deflated(`${prefix}pack.json`, headOf([doc])), deflated(`${prefix}assets/${sha}.mesh`, bytes), ...extra]);
  for (const z of [zipped(''), zipped('Shrine/'), zipped('Shrine/', [{ name: '__MACOSX/Shrine/._pack.json', data: new Uint8Array(4) }])]) {
    const r = await readPackBytes(z);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.pois, [doc]);
    assert.equal(r.assets.get(sha).submeshes, 1);
    assert.equal((await readPack(await readZipEntries(asBytes(z)))).ok, true, 'readPack over the whole archive the same');
  }
  assert.equal(packRoot(['Shrine/pack.json', 'Shrine/assets/x.mesh', '__MACOSX/Shrine/._pack.json']), 'Shrine/');
  assert.equal(packRoot(['a/pack.json', 'b/assets/x.mesh']), null);
  assert.deepEqual(await readPackBytes(zipOf([{ name: 'a/pack.json', data: headOf([doc]) }, { name: `b/assets/${sha}.mesh`, data: bytes }])), { ok: false, code: 'pack-not-a-pack' });
});

test('AUDIT POI P5 A PACK\'S ZIP, BOUNDED: the central directory counted before a byte is inflated; pack.json alone first, to its bound; then only the assets it names, each to its kind\'s bound and all to the pack\'s - a declared size past one refused before inflating, an entry inflating past what it declared stopped there; a file nothing names never inflated (mutants: every file inflated; the count unasked; a kind\'s bound unasked; the whole unbounded; pack.json unbounded; the bounds asked as it inflates; an inflation never stopped; a stored entry longer than it says)', async () => {
  const { bytes, sha } = await tri();
  const doc = docOf('poi-00000000beef', { parts: [part('altar', sha)] });
  const head = deflated('pack.json', headOf([doc])), mesh = deflated(`assets/${sha}.mesh`, bytes);
  // a file nothing names, whose bytes no inflater takes: never inflated (the whole-archive read throws on it)
  const junky = zipOf([head, mesh, { name: 'readme.bin', data: NOT_DEFLATE, method: 8, size: 256 * 1024 * 1024 }]);
  await assert.rejects(readZipEntries(asBytes(junky)), 'inflating it fails, or this pin proves nothing');
  const r = await readPackBytes(junky);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([...r.assets.keys()], [sha]);
  // the count: one past the bound, refused before anything is inflated
  const crowd = zipStore([{ name: 'pack.json', data: headOf([doc]) }, ...Array.from({ length: POI_PACK_LIMITS.files }, (_, i) => ({ name: `x/${i}`, data: new Uint8Array(0) }))]);
  assert.deepEqual(await readPackBytes(crowd), { ok: false, code: 'pack-too-large' });
  // a named mesh declaring more than a mesh may be: refused before its bytes (no deflate) are touched
  assert.deepEqual(await readPackBytes(zipOf([head, { name: `assets/${sha}.mesh`, data: NOT_DEFLATE, method: 8, size: POI_MESH_LIMITS.bytes + 1 }])), { ok: false, code: 'pack-too-large' });
  // all of them past the pack's bytes: sixty-five meshes declaring 16.5 MiB each
  const heavy = docOf('poi-00000000beef', { parts: Array.from({ length: 65 }, (_, i) => part(`p${i}`, fakeSha(i))) });
  const sixtyFive = Array.from({ length: 65 }, (_, i) => ({ name: `assets/${fakeSha(i)}.mesh`, data: NOT_DEFLATE, method: 8, size: 16.5 * 1024 * 1024 }));
  assert.deepEqual(await readPackBytes(zipOf([deflated('pack.json', headOf([heavy])), ...sixtyFive])), { ok: false, code: 'pack-too-large' });
  // pack.json declaring past its bound
  assert.deepEqual(await readPackBytes(zipOf([{ name: 'pack.json', data: NOT_DEFLATE, method: 8, size: POI_PACK_LIMITS.headBytes + 1 }])), { ok: false, code: 'pack-too-large' });
  // an entry that inflates past what it declared: a mebibyte of nothing that says it is a thousand bytes
  const zeros = new Uint8Array(1024 * 1024), zerosSha = await sha256(zeros);
  const liar = docOf('poi-00000000beef', { parts: [part('altar', zerosSha)] });
  assert.deepEqual(await readPackBytes(zipOf([deflated('pack.json', headOf([liar])), { ...deflated(`assets/${zerosSha}.mesh`, zeros), size: 1000 }])), { ok: false, code: 'pack-too-large' });
  // a stored entry longer than it says
  assert.deepEqual(await readPackBytes(zipOf([head, { name: `assets/${sha}.mesh`, data: bytes, method: 0, size: 10 }])), { ok: false, code: 'pack-too-large' });
  // readZipEntries' bound is the caller's alone: without one, the archive reads as it always has
  const plain = await readZipEntries(asBytes(zipOf([head, mesh])));
  assert.deepEqual(plain.map((x) => [x.name, x.data.byteLength]), [['pack.json', headOf([doc]).length], [`assets/${sha}.mesh`, bytes.length]]);
  await assert.rejects(readZipEntries(asBytes(zipOf([head, mesh])), { limit: () => 10 }), (err) => err.code === 'zip-too-large');
});

// ── INTO THE STORE ──────────────────────────────────────────────────

/** A fake shelf over a Map: who may put over what is the real store's (poi4b's pins); here only what is asked. */
function fakeShelf(items = new Map(), gone = new Set()) {
  const calls = [];
  return {
    items, calls,
    // PIN MOVED (AUDIT POI U13, lane A): an entry taken off answers 'poi-gone', as the store now does
    shelfEntry: async (id) => { calls.push(['ask', id]); return gone.has(id) ? { ok: false, error: 'poi-gone' } : items.has(id) ? { ok: true, data: { id, item: structuredClone(items.get(id)) } } : { ok: false, error: 'not-found' }; },
    shelve: async (item) => { calls.push(['put', item.id]); if (gone.has(item.id)) return { ok: false, error: 'poi-gone' }; items.set(item.id, structuredClone(item)); return { ok: true, data: { id: item.id } }; },
  };
}
const packOf = (shelf = [], pois = []) => ({ pois, shelf, assets: new Map() });
const noHistory = async () => ({ ok: false, error: 'not-found' });

test('AUDIT POI P4 AN ENTRY INTO THE SHELF, NEVER OVER ANOTHER: its id free, put there; the store has it as the pack does, left as it is; the store has another under its id, put under a copy\'s id of its own - the same at every import, so a second import finds the first one\'s; that id taken by another too, the next; taken off the shelf, put under a copy\'s; the store\'s refusal with the law\'s problems carried back (mutants: the store unasked; one alike put again; a copy\'s id random; a taken-off entry not passed by; the problems dropped)', async () => {
  const well = entryOf('lib-00000000cafe');
  const rand = (b) => b.fill(9);
  // its id free
  let s = fakeShelf();
  let r = await importPack(packOf([well]), { putAsset: null, history: noHistory, ...s, rand });
  assert.deepEqual(s.calls, [['ask', well.id], ['put', well.id]]);
  assert.deepEqual([r.ok, r.shelved, r.copied, r.already], [true, 1, 0, 0]);
  // the store has it as the pack does - its keys in another order, too
  s = fakeShelf(new Map([[well.id, Object.fromEntries(Object.entries(well).reverse())]]));
  r = await importPack(packOf([well]), { putAsset: null, history: noHistory, ...s, rand });
  assert.deepEqual(s.calls, [['ask', well.id]], 'nothing put');
  assert.deepEqual([r.shelved, r.copied, r.already], [1, 0, 1]);
  // the store has another under its id (a builder's newer one): never put over - a copy's id of its own
  const newer = { ...well, name: 'Well (v2, current)' };
  s = fakeShelf(new Map([[well.id, newer]]));
  r = await importPack(packOf([well]), { putAsset: null, history: noHistory, ...s, rand });
  const copy0 = await copyIdOf(well, 0);
  assert.match(copy0, /^lib-[0-9a-f]{12}$/);
  assert.deepEqual(s.items.get(well.id), newer, 'the builder\'s entry as it was');
  assert.deepEqual(s.calls, [['ask', well.id], ['ask', copy0], ['put', copy0]]);
  assert.deepEqual(s.items.get(copy0), { ...well, id: copy0 });
  assert.deepEqual([r.shelved, r.copied, r.already], [1, 1, 0]);
  // imported again: the copy found, nothing put
  s.calls.length = 0;
  r = await importPack(packOf([well]), { putAsset: null, history: noHistory, ...s, rand });
  assert.deepEqual(s.calls, [['ask', well.id], ['ask', copy0]]);
  assert.equal(s.items.size, 2);
  assert.deepEqual([r.shelved, r.copied, r.already], [1, 1, 1]);
  // the copy changed since by its keeper: the next copy's id
  s.items.set(copy0, { ...well, id: copy0, name: 'Well (mine)' });
  s.calls.length = 0;
  r = await importPack(packOf([well]), { putAsset: null, history: noHistory, ...s, rand });
  const copy1 = await copyIdOf(well, 1);
  assert.deepEqual(s.calls, [['ask', well.id], ['ask', copy0], ['ask', copy1], ['put', copy1]]);
  // taken off the shelf (kept, read and put over no more): passed by, put under a copy's id
  s = fakeShelf(new Map([[well.id, well]]), new Set([well.id]));
  r = await importPack(packOf([well]), { putAsset: null, history: noHistory, ...s, rand });
  assert.deepEqual([r.ok, r.copied], [true, 1]);
  assert.deepEqual(s.calls, [['ask', well.id], ['ask', copy0], ['put', copy0]], 'its id passed by, never put to');
  // taken off between the ask (not there) and the put: the next id
  s = fakeShelf();
  const put = s.shelve;
  s.shelve = async (item) => (item.id === well.id ? (s.calls.push(['put', item.id]), { ok: false, error: 'poi-gone' }) : put(item));
  r = await importPack(packOf([well]), { putAsset: null, history: noHistory, ...s, rand });
  assert.deepEqual([r.ok, r.copied], [true, 1]);
  assert.deepEqual(s.calls, [['ask', well.id], ['put', well.id], ['ask', copy0], ['put', copy0]]);
  // a store that cannot be asked: refused, said where
  r = await importPack(packOf([well]), { putAsset: null, history: noHistory, shelfEntry: async () => ({ ok: false, error: 'offline' }), shelve: async () => assert.fail('never put unasked'), rand });
  assert.deepEqual(r, { ok: false, error: 'offline', at: 'Well' });
  // C5: the store's refusal brings the law's problems back
  const problems = [{ path: 'parts[0].materials', code: 'material-count', have: 3, want: 1 }];
  r = await importPack(packOf([well]), { putAsset: null, history: noHistory, shelfEntry: async () => ({ ok: false, error: 'not-found' }), shelve: async () => ({ ok: false, error: 'poi-doc', problems }), rand });
  assert.deepEqual(r, { ok: false, error: 'poi-doc', at: 'Well', problems });
});

test('AUDIT POI P4 ON THE REAL WORKER: a builder\'s entry changed since the pack was made is left as it is - another builder\'s import puts one copy however often it runs, and the approver\'s finds that copy (the approver\'s import put the pack\'s older copy over the builder\'s current one; another builder\'s made a copy each time)', async () => {
  forgetPoiFeed();
  const s = await standService({ DEVELOPER_HANDLES: 'Dev', BUILDER_HANDLES: 'Mapper', APPROVER_HANDLES: 'Mac' });
  const dev = await s.registered('Dev'), mapper = await s.registered('Mapper'), mac = await s.registered('Mac');
  const ioOf = (who) => ({ fetch: s.fetch, base: 'https://accounts.invalid', secret: who.secret });
  const io = (who) => ({ putAsset: (b, k) => poiPutAsset(ioOf(who), b, k), history: (id) => poiHistory(ioOf(who), id), shelfEntry: (id) => poiShelfEntry(ioOf(who), id), shelve: (it) => poiShelve(ioOf(who), it), rand: (b) => crypto.getRandomValues(b) });
  const { bytes, sha } = await tri();
  const well = (name) => entryOf('lib-00000000d0d0', { name, parts: [part('well', sha)] });
  assert.equal((await poiPutAsset(ioOf(dev), bytes, 'mesh')).ok, true);
  assert.equal((await poiShelve(ioOf(dev), well('Well (v1)'))).ok, true);
  const w = writePack({ shelf: [well('Well (v1)')], assets: new Map([[sha, bytes]]) });
  const pack = await readPackBytes(w.bytes);
  assert.equal(pack.ok, true);
  assert.equal((await poiShelve(ioOf(dev), well('Well (v2, current)'))).ok, true);
  const shelf = async () => (await poiShelf(ioOf(dev))).data.items.map((x) => [x.name, x.by]).sort();
  const counts = [];
  for (let i = 0; i < 2; i++) {
    const r = await importPack(pack, io(mapper));
    assert.equal(r.ok, true);
    assert.deepEqual(await shelf(), [['Well (v1)', 'Mapper'], ['Well (v2, current)', 'Dev']], `one copy after import ${i + 1}`);
    counts.push([r.shelved, r.copied, r.already]);
  }
  const r = await importPack(pack, io(mac));
  assert.equal(r.ok, true);
  assert.equal((await poiShelfEntry(ioOf(dev), 'lib-00000000d0d0')).data.item.name, 'Well (v2, current)', 'Dev\'s entry as Dev left it');
  assert.deepEqual(await shelf(), [['Well (v1)', 'Mapper'], ['Well (v2, current)', 'Dev']], 'the approver finds the copy');
  counts.push([r.shelved, r.copied, r.already]);
  assert.deepEqual(counts, [[1, 1, 0], [1, 1, 1], [1, 1, 1]]);
  // P3 on the same store: a pack the store would refuse halfway is refused whole, before anything is uploaded
  const wrong = { ...entryOf('lib-00000000e1e1', { name: 'Wrong count' }), parts: [part('well', sha, { materials: [{ ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }] })] };
  const zip = zipStore([{ name: 'pack.json', data: headOf([], [entryOf('lib-00000000e0e0', { name: 'Fine', parts: [part('well', sha)] }), wrong]) }, { name: `assets/${sha}.mesh`, data: bytes }]);
  assert.deepEqual((await readPackBytes(zip)).problem, { path: 'parts[0].materials', code: 'material-count', have: 2, want: 1 });
});

test('AUDIT POI T1 INTO THE STORE, THE POIS AND THE COUNT: a POI the store knows with no live revision opened as a draft, not live; one the store cannot be asked about refuses the import, said where; the progress said for every asset, entry and POI; an export of a model fetches its glow picture too (mutants: no live one read as live; any refusal read as new; the assets\' progress unsaid; the glow left behind)', async () => {
  const doc = docOf('poi-00000000beef'), done = [];
  const io = {
    putAsset: async () => ({ ok: true, data: { existed: false } }),
    history: async (id) => (id === doc.id ? { ok: true, data: { id, liveRev: null, revs: [{ rev: 1, doc, state: 'draft' }] } } : { ok: false, error: 'offline' }),
    ...fakeShelf(), rand: (b) => b, progress: (n, of) => done.push([n, of]),
  };
  const pack = { pois: [doc], shelf: [entryOf('lib-00000000cafe')], assets: new Map([['m', { kind: 'mesh', bytes: new Uint8Array(1) }]]) };
  const r = await importPack(pack, io);
  assert.deepEqual(r.open.map((o) => [o.state, o.saved, o.base]), [['draft', null, null]]);
  assert.deepEqual(done, [[1, 3], [2, 3], [3, 3]]);
  assert.deepEqual(await importPack({ ...pack, pois: [docOf('poi-0000000f00d0', { name: 'Hut' })] }, io), { ok: false, error: 'offline', at: 'Hut' });
  // the glow picture fetched with the base one, and embedded
  const { bytes, sha } = await tri(), pic = await sha256(PNG);
  const asked = [];
  const glb = await exportModel({ name: 'Lamp', parts: [part('lamp', sha, { materials: [{ ...DEFAULT_MATERIAL, emissive: pic, emissiveColor: [1, 1, 1] }] })] }, async (h) => { asked.push(h); return h === sha ? bytes : PNG; });
  assert.equal(glb.ok, true);
  assert.deepEqual(asked, [sha, pic]);
  assert.equal(readGltf(glb.bytes).images.length, 1);
});

// ── THE SHELF ENTRY ─────────────────────────────────────────────────

test('AUDIT POI T3 AN ENTRY FROM PARTS NOT THE DEFAULTS: each part\'s turn and size, a part that is not solid and casts no shadow, kept as they are; its lights its own copies; a picture the store will not take stops the keeping, nothing put (mutants: the turn and size dropped; the solidity dropped; the shadow dropped; the lights shared; the refused picture ignored)', async () => {
  const r = quatAngleAxis(45, [0, 1, 0]), lights = [{ t: [0, 2, 0], color: [1, 0.5, 0], radius: 4, intensity: 1, flicker: true }];
  const e = shelfEntryOf({ id: 'lib-00000000beef', name: 'Gate', parts: [{ name: 'Post', mesh: 'a'.repeat(64), submeshes: 1, t: [1, 0, 0], r, s: [2, 1, 0.5], collide: 'none', shadow: false }], lights });
  assert.deepEqual(poiShelfProblems(e), []);
  const [p] = e.parts;
  assert.ok(quatAngleDeg(p.r, r) < 1e-4, 'its turn');
  assert.deepEqual([p.s, p.collide, p.shadow], [[2, 1, 0.5], 'none', false]);
  lights[0].radius = 99;
  assert.equal(e.lights[0].radius, 4, 'its lights its own');
  const calls = [];
  const kept = await putOnShelf(e, {
    meshOf: async () => TRI, pictureOf: async () => null,
    putAsset: async () => { calls.push('asset'); return { ok: false, error: 'poi-quota' }; },
    shelve: async () => { calls.push('shelve'); return { ok: true, data: { id: e.id } }; },
  });
  assert.deepEqual(kept, { ok: false, error: 'poi-quota' });
  assert.deepEqual(calls, ['asset'], 'nothing put once its picture is refused');
});
