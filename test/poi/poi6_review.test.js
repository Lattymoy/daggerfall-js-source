// POI-6 (2026-10-14; bible/06-Systems/POI-Editor-Arc.md) - APPROVALS, HISTORY, AND POIS OUT AND BACK IN.
// Mac: "I need to be able to approve changes"; "the ability to import models, texture, UV map ... a tool my developers
// can use without having to access the codebase".
//   - what a submission changes (src/poi/poiDiff.js), in words (src/poi/poiText.js diffText);
//   - a model back out as glTF (src/poi/gltfExport.js), read again by the editor's own importer to the same model;
//   - a pack (src/poi/poiPack.js): written, read, and every way it is refused; carried into the store
//     (src/poi/poiTransfer.js);
//   - the approver's queue and a POI's history (src/ui/poi/poiReviewPanel.js) and the panel's out-and-in buttons
//     (src/ui/poi/poiEditorPanel.js) over the shared fake document.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { poiDiff, quatAngleDeg } from '../../src/poi/poiDiff.js';
import { diffText, packErrorText } from '../../src/poi/poiText.js';
import { writeGlb, mirrorQuatX } from '../../src/poi/gltfExport.js';
import { readGltf, bakeGltf, poiMaterialOf } from '../../src/poi/gltfImport.js';
import { writePack, readPack, readPackBytes, packAssetName } from '../../src/poi/poiPack.js';
import { exportModel, exportPack, importPack, fileNameOf, copyIdOf } from '../../src/poi/poiTransfer.js';
import { readZipEntries } from '../../src/scenes/dataSource.js';
import { zipStore } from '../../src/systems/save/saveTransfer.js';
import { encodePoiMesh } from '../../src/poi/poiMesh.js';
import { DEFAULT_MATERIAL, poiDocProblems } from '../../src/poi/poiLaw.js';
import { mat4FromQuatPosScale, quatAngleAxis } from '../../src/world/quat.js';
import { createPoiEdit, newPart } from '../../src/poi/poiEdit.js';
import { createPoiEditorPanel } from '../../src/ui/poi/poiEditorPanel.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
/** Wait until `cond` holds - hashing runs off the main thread, so no count of turns is sure to outlast it. */
const until = async (cond, what) => { const end = Date.now() + 10000; while (!cond()) { if (Date.now() > end) assert.fail(`never: ${what}`); await new Promise((r) => setTimeout(r, 1)); } };
const counting = () => { let n = 0; return (b) => { for (let i = 0; i < b.length; i++) b[i] = (n + i) & 255; n++; return b; }; };
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));
/** The smallest lossless WebP the header reader takes (a 1 x 1 VP8L). */
const WEBP = Uint8Array.from(Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64'));

/** A cube, each face its own corners, wound so (b - a) x (c - a) is its outward normal (the import's way); two submeshes. */
function cube() {
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  const pos = [], nor = [], uv = [], idx = [];
  for (const [n, a, b] of faces) {
    const base = pos.length / 3;
    for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { pos.push(...[0, 1, 2].map((k) => n[k] * 0.5 + (i - 0.5) * b[k] + (j - 0.5) * a[k])); nor.push(...n); uv.push(i, 1 - j); }
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  return { positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv), indices: Uint16Array.from(idx), submeshes: [{ start: 0, count: 12 }, { start: 12, count: 24 }] };
}
const place = (extra = {}) => ({ px: 200, py: 210, x: 100, z: 200, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1, ...extra });
const part = (key, mesh, extra = {}) => ({ key, name: key, mesh, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true, materials: [{ ...DEFAULT_MATERIAL }], ...extra });
const docOf = (id, extra = {}) => ({ v: 1, id, name: 'Old tower', place: place(), parts: [part('tower', 'a'.repeat(64))], lights: [], marker: { show: false }, ...extra });

// ── WHAT A SUBMISSION CHANGES ────────────────────────────────────────

test('POI-6 WHAT IT CHANGES: a revision against the live one - renamed, moved, turned, resized, its ground; a part added, taken away, or changed (and how), matched by its key; its lights and mark; new and retired; a turn by the same rotation\'s other sign no turn; said in words (mutants: parts matched by place in the list; the quaternion\'s sign read as a turn)', () => {
  const before = docOf('poi-00000000beef', { parts: [part('tower', 'a'.repeat(64)), part('door', 'b'.repeat(64))] });
  assert.deepEqual(poiDiff(before, structuredClone(before)), []);
  assert.deepEqual(poiDiff(null, before), [{ code: 'new', parts: 2, lights: 0 }]);
  assert.deepEqual(poiDiff(before, null), [{ code: 'retire' }]);
  const after = structuredClone(before);
  after.name = 'Older tower';
  after.place.x += 3; after.place.z += 4;
  after.place.r = quatAngleAxis(90, [0, 1, 0]);
  after.place.s = 2;
  after.place.ground = 'absolute';
  after.parts = [{ ...after.parts[1], t: [0, 1, 0], materials: [{ ...DEFAULT_MATERIAL, color: [1, 0, 0, 1] }] }, after.parts[0], part('flag', 'c'.repeat(64))];
  after.parts[1] = { ...after.parts[1], mesh: 'd'.repeat(64), name: 'Keep' };
  after.lights = [{ t: [0, 2, 0], color: [1, 1, 1], radius: 5, intensity: 1, flicker: false }];
  after.marker = { show: true, label: 'Tower' };
  const d = poiDiff(before, after);
  const codes = d.map((c) => c.code);
  assert.deepEqual(codes, ['name', 'moved', 'ground', 'turned', 'sized', 'part-changed', 'part-changed', 'part-added', 'lights', 'marker']);
  assert.equal(d.find((c) => c.code === 'moved').m, 5);
  assert.equal(d.find((c) => c.code === 'turned').deg, 90);
  assert.deepEqual(d.filter((c) => c.code === 'part-changed').map((c) => [c.name, c.what]), [['door', ['moved', 'materials']], ['Keep', ['model', 'name']]], 'matched by key, not by place in the list');
  // a part taken away
  assert.deepEqual(poiDiff(before, { ...before, parts: [before.parts[0]] }).map((c) => [c.code, c.name]), [['part-removed', 'door']]);
  // the same turn written with the other sign is no turn
  const q = quatAngleAxis(40, [0, 1, 0]);
  assert.ok(quatAngleDeg(q, q.map((c) => -c)) < 1e-6);
  assert.deepEqual(poiDiff({ ...before, place: place({ r: q }) }, { ...before, place: place({ r: q.map((c) => -c) }) }), []);
  // in words
  assert.equal(diffText({ code: 'moved', m: 5 }), 'Moved 5 m.');
  assert.equal(diffText(d.find((c) => c.code === 'part-changed')), 'Part door: moved, its materials.');
  assert.equal(diffText({ code: 'new', parts: 1, lights: 2 }), 'A new POI: 1 part, 2 lights.');
  assert.equal(packErrorText({ code: 'pack-asset-hash' }), 'A model or picture in the pack is not what its name says.');
});

// ── BACK OUT AS glTF ────────────────────────────────────────────────

const W = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

test('POI-6 BACK OUT AS glTF: a part written as a node with its offset, turn and size, read again by the importer to the same corners in the game\'s frame, in the same winding, with the same normals and UVs; its materials - colour, cut, both sides, a glow past one, its picture embedded, its picture\'s turn - as the importer reads them; WebP required by its extension; lights as KHR_lights_punctual; the container\'s chunks aligned (mutants: the turn not mirrored; the winding kept; the normals unmirrored; the glow\'s strength dropped; WebP not required)', () => {
  const m = cube();
  const r = quatAngleAxis(30, [0, 1, 0]);
  const picSha = 'e'.repeat(64), webSha = 'f'.repeat(64);
  const parts = [
    { key: 'box', name: 'Box', mesh: m, t: [2, 1, -3], r, s: [1, 2, 1], materials: [
      { ...DEFAULT_MATERIAL, color: [1, 0, 0, 1], texture: picSha, uv: { offset: [0.5, 0], scale: [2, 1], rotation: 0 } },
      { ...DEFAULT_MATERIAL, alpha: 'cutout', cutoff: 0.3, twoSided: true, emissiveColor: [4, 2, 0] },
    ] },
  ];
  const glb = writeGlb({ name: 'Test', parts, lights: [{ t: [1, 2, 3], color: [1, 0.5, 0], radius: 6, intensity: 2 }], pictures: new Map([[picSha, { bytes: PNG, format: 'png' }]]) });
  // the container: header length, chunks four-byte aligned
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  assert.equal(dv.getUint32(8, true), glb.byteLength);
  assert.equal(dv.getUint32(12, true) % 4, 0);
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + dv.getUint32(12, true))));
  assert.deepEqual(json.extensionsUsed, ['KHR_lights_punctual', 'KHR_materials_emissive_strength', 'KHR_texture_transform']);
  assert.equal(json.extensions.KHR_lights_punctual.lights[0].range, 6);
  assert.deepEqual(json.nodes[1].rotation, mirrorQuatX(r));
  const model = readGltf(glb);
  // PIN MOVED (AUDIT POI G7): the importer reads a point light back now (gltfImport.js poiLightOf) - it was set aside,
  // said as `camera-light`
  assert.deepEqual(model.warnings, [], 'the light read back, nothing set aside');
  assert.equal(model.lights.length, 1);
  const [back] = bakeGltf(model, { split: 'nodes' });
  assert.deepEqual(back.position, [2, 1, -3]);
  assert.deepEqual(back.mesh.submeshes, m.submeshes);
  // every corner where it stood, in the same order (the same winding), its normal the same
  const M = mat4FromQuatPosScale(r, [2, 1, -3], [1, 2, 1]);
  let far = 0, bent = 0;
  for (let i = 0; i < m.indices.length; i++) {
    const v = m.indices[i], u = back.mesh.indices[i];
    const a = W(M, m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]);
    const p = [back.mesh.positions[u * 3] + 2, back.mesh.positions[u * 3 + 1] + 1, back.mesh.positions[u * 3 + 2] - 3];
    far = Math.max(far, Math.hypot(a[0] - p[0], a[1] - p[1], a[2] - p[2]));
    // the normal turned (and its scale inverted) as the part turns it
    const s = [1, 2, 1], nn = [m.normals[v * 3] / s[0], m.normals[v * 3 + 1] / s[1], m.normals[v * 3 + 2] / s[2]];
    const w = W([...M.slice(0, 12), 0, 0, 0, 1], ...nn), l = Math.hypot(...w);
    bent = Math.max(bent, Math.hypot(w[0] / l - back.mesh.normals[u * 3], w[1] / l - back.mesh.normals[u * 3 + 1], w[2] / l - back.mesh.normals[u * 3 + 2]));
  }
  assert.ok(far < 1e-5, `every corner where it stood (${far})`);
  assert.ok(bent < 1e-5, `every normal as it was (${bent})`);
  // the first material's picture turn baked into its UVs by the importer: u * 2 + 0.5
  const u0 = m.uvs[m.indices[0] * 2], ub = back.mesh.uvs[back.mesh.indices[0] * 2];
  assert.ok(Math.abs(ub - (u0 * 2 + 0.5)) < 1e-6, `its picture's transform (${u0} -> ${ub})`);
  // the materials as the importer reads them
  const [m0, m1] = model.materials;
  assert.deepEqual(m0.color, [1, 0, 0, 1]);
  assert.deepEqual([...model.images[m0.base.image].bytes], [...PNG], 'its picture embedded');
  assert.deepEqual([m1.alpha, m1.cutoff, m1.twoSided], ['cutout', 0.3, true]);
  // PIN MOVED (AUDIT POI R10): the glow is written linear with its strength apart - the game's [4, 2, 0] is the POI
  // material poiMaterialOf turns it back to, not readGltf's factor
  assert.deepEqual(poiMaterialOf(m1).emissiveColor, [4, 2, 0], 'the glow past one, by its strength');
  // a WebP picture: the extension required (there is no fallback)
  const web = writeGlb({ name: 'W', parts: [{ ...parts[0], materials: [{ ...DEFAULT_MATERIAL, texture: webSha }, { ...DEFAULT_MATERIAL }] }], pictures: new Map([[webSha, { bytes: WEBP, format: 'webp' }]]) });
  const wj = JSON.parse(new TextDecoder().decode(web.subarray(20, 20 + new DataView(web.buffer).getUint32(12, true))));
  assert.deepEqual(wj.extensionsRequired, ['EXT_texture_webp']);
  assert.equal(readGltf(web).images.length, 1);
  assert.equal(fileNameOf('Old Tower: west/1', 'glb'), 'Old-Tower-west1.glb');
  assert.equal(fileNameOf('***', 'zip'), 'poi.zip');
});

// ── A PACK ──────────────────────────────────────────────────────────

test('POI-6 A PACK: written with every asset it names, read back whole through the port\'s zip reader; refused, never half-read: not a pack, another version, a document short of the law, an asset not what its name says or damaged, a name it does not carry; a writer missing an asset refuses (mutants: the hash unchecked; a missing asset passed; the law unasked)', async () => {
  const meshBytes = encodePoiMesh(cube()), meshSha = await sha256(meshBytes), picSha = await sha256(PNG);
  const doc = docOf('poi-00000000beef', { parts: [part('tower', meshSha, { materials: [{ ...DEFAULT_MATERIAL, texture: picSha }, { ...DEFAULT_MATERIAL }] })] });
  const entry = { v: 1, id: 'lib-00000000cafe', name: 'Tower', parts: doc.parts, lights: [], thumb: picSha };
  const w = writePack({ pois: [doc], shelf: [entry], assets: new Map([[meshSha, meshBytes], [picSha, PNG]]) });
  assert.equal(w.ok, true);
  const entries = await readZipEntries({ arrayBuffer: async () => w.bytes.slice().buffer });
  assert.deepEqual(entries.map((e) => e.name).sort(), ['assets/' + meshSha + '.mesh', 'assets/' + picSha + '.png', 'pack.json'].sort());
  assert.equal(packAssetName(picSha, PNG), `assets/${picSha}.png`);
  const r = await readPack(entries);
  assert.equal(r.ok, true);
  assert.deepEqual(r.pois, [doc]);
  assert.deepEqual(r.shelf, [entry]);
  assert.deepEqual([...r.assets.keys()].sort(), [meshSha, picSha].sort());
  assert.equal(r.assets.get(meshSha).submeshes, 2);
  // the refusals
  const head = (o) => ({ name: 'pack.json', data: new TextEncoder().encode(JSON.stringify(o)) });
  const rest = entries.filter((e) => e.name !== 'pack.json');
  assert.equal((await readPack(rest)).code, 'pack-not-a-pack');
  assert.equal((await readPack([head({ v: 2, kind: 'poi-pack', pois: [], shelf: [] })])).code, 'pack-version');
  const bad = await readPack([head({ v: 1, kind: 'poi-pack', pois: [{ ...doc, name: '' }], shelf: [] }), ...rest]);
  assert.deepEqual([bad.code, bad.problem.code], ['pack-bad-poi', 'name']);
  const lying = rest.map((e) => (e.name.endsWith('.png') ? { name: e.name, data: Uint8Array.from([...PNG.slice(0, -1), 0]) } : e));
  assert.equal((await readPack([entries.find((e) => e.name === 'pack.json'), ...lying])).code, 'pack-asset-hash');
  const junk = new TextEncoder().encode('not a mesh at all, but long enough to be read as one header..');
  // PIN MOVED (AUDIT POI P11): a file no document names is no longer read at all, so the damaged mesh is one a POI wears
  assert.equal((await readPack([head({ v: 1, kind: 'poi-pack', pois: [docOf('poi-00000000beef', { parts: [part('tower', await sha256(junk))] })], shelf: [] }), { name: `assets/${await sha256(junk)}.mesh`, data: junk }])).code, 'pack-asset-bad');
  const short = await readPack([entries.find((e) => e.name === 'pack.json'), ...rest.filter((e) => !e.name.endsWith('.png'))]);
  assert.deepEqual([short.code, short.sha], ['pack-missing-asset', picSha]);
  assert.deepEqual(writePack({ pois: [doc], assets: new Map([[meshSha, meshBytes]]) }), { ok: false, code: 'pack-missing-asset', sha: picSha });
  // a zip the reader cannot read is no pack, nor is a zip with nothing in it (the panel says so) - AUDIT POI T4: this
  // asked that an empty zip has bytes, which no reader could fail
  assert.deepEqual(await readPackBytes(new TextEncoder().encode('not a zip')), { ok: false, code: 'pack-not-a-pack' });
  assert.deepEqual(await readPackBytes(zipStore([])), { ok: false, code: 'pack-not-a-pack' });
});

test('POI-6 INTO THE STORE: a pack\'s assets uploaded by name (those the store has counted apart), its library entries put - under a new id where the store keeps another builder\'s - and its POIs handed back to open: as a change to the live one where the store knows it, else as new; an export that cannot fetch an asset says which (mutants: an entry not re-minted; a known POI opened as new)', async () => {
  const doc = docOf('poi-00000000beef'), fresh = docOf('poi-0000000f00d0', { name: 'New hut' });
  const live = docOf('poi-00000000beef', { name: 'Old tower (live)' });
  const entry = { v: 1, id: 'lib-00000000cafe', name: 'Tower', parts: doc.parts, lights: [], thumb: null };
  const calls = [];
  const io = {
    putAsset: async (bytes, kind) => { calls.push(['put', kind]); return { ok: true, data: { sha: 'x', existed: kind === 'texture' } }; },
    history: async (id) => (id === doc.id ? { ok: true, data: { id, liveRev: 3, revs: [{ rev: 3, doc: live }, { rev: 4, doc }] } } : { ok: false, error: 'not-found' }),
    // PIN MOVED (AUDIT POI P4): the shelf is asked before an entry is put - the store keeps another entry under its id,
    // so the pack's is put under a copy's id of its own, never over it (it was put over first, and minted afresh only
    // where the store refused that)
    shelfEntry: async (id) => (id === 'lib-00000000cafe' ? { ok: true, data: { id, item: { ...entry, name: 'Tower (theirs)' } } } : { ok: false, error: 'not-found' }),
    shelve: async (item) => { calls.push(['shelve', item.id]); return { ok: true, data: { id: item.id } }; },
    rand: counting(),
  };
  const pack = { pois: [doc, fresh], shelf: [entry], assets: new Map([['m', { kind: 'mesh', bytes: new Uint8Array(1) }], ['p', { kind: 'texture', bytes: new Uint8Array(1) }]]) };
  const r = await importPack(pack, io);
  assert.equal(r.ok, true);
  assert.deepEqual([r.uploaded, r.existed, r.shelved], [1, 1, 1]);
  assert.deepEqual(calls, [['put', 'mesh'], ['put', 'texture'], ['shelve', await copyIdOf(entry, 0)]], 'another entry under its id: put under one of its own');
  assert.deepEqual(r.open.map((o) => [o.id, o.state, o.base, o.saved?.name ?? null]), [[doc.id, 'live', 3, 'Old tower (live)'], [fresh.id, 'new', null, null]]);
  const stop = await importPack(pack, { ...io, putAsset: async () => ({ ok: false, error: 'poi-quota' }) });
  assert.deepEqual([stop.ok, stop.error], [false, 'poi-quota']);
  // an export that cannot fetch
  const failed = await exportModel({ name: 'x', parts: [part('a', 'a'.repeat(64))] }, async () => { throw new Error('offline'); });
  assert.deepEqual(failed, { ok: false, code: 'export-fetch', sha: 'a'.repeat(64) });
  assert.equal((await exportPack({ pois: [doc] }, async () => { throw new Error('offline'); })).code, 'export-fetch');
});

// ── THE APPROVER'S QUEUE AND A POI'S HISTORY ─────────────────────────

function store() {
  const s = { asks: [], queue: [], history: new Map() };
  const ok = (body) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });
  s.fetch = async (url, init = {}) => {
    const path = url.replace('https://svc', '');
    const body = init.body === undefined ? undefined : typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    s.asks.push({ path, method: init.method ?? 'GET', body });
    if (path === '/v1/poi/queue') return ok({ queue: s.queue });
    if (path === '/v1/poi/review') return ok({ id: body.id, rev: body.rev, state: body.verdict === 'approve' ? 'approved' : 'rejected' });
    if (path === '/v1/poi/rollback') return ok({ id: body.id, rev: body.rev, live: true });
    const h = /^\/v1\/poi\/doc\/(poi-[0-9a-f]{12})$/.exec(path);
    if (h) return s.history.has(h[1]) ? ok(s.history.get(h[1])) : { ok: false, status: 404, headers: { get: () => null }, json: async () => ({ error: 'not-found' }) };
    const a = /^\/v1\/poi\/asset\/([0-9a-f]{64})\?kind=(mesh|texture)$/.exec(path);
    if (a) return ok({ sha: a[1], kind: a[2], meta: a[2] === 'mesh' ? { submeshes: 2 } : { w: 1, h: 1 }, existed: false });
    return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({ error: 'not-found' }) };
  };
  return s;
}
const all = (root) => root.querySelectorAll('*');
const button = (root, text) => all(root).find((n) => n.tagName === 'BUTTON' && n.textContent === text);
const editorStub = () => ({ mode: () => 'move', setMode() {}, space: () => 'world', setSpace() {}, snapOn: () => false, setSnap() {}, snapSteps: () => ({ move: 0.25, turn: 15, size: 0.1 }), eyeSpeed: () => 12, placeNew() {}, placeAsset() {} });

async function panelOver({ approver = true } = {}) {
  const meshBytes = encodePoiMesh(cube());
  const sha = await sha256(meshBytes);
  const assets = new Map([[sha, meshBytes]]);
  const svc = store();
  const edit = createPoiEdit({ rand: counting() });
  const went = [], files = [];
  const panel = createPoiEditorPanel({
    doc: document, edit, editor: editorStub(), feed: { asset: async (h) => { if (!assets.has(h)) throw new Error('poi asset: 404'); return assets.get(h); } },
    io: () => ({ fetch: svc.fetch, base: 'https://svc', secret: 'tok' }), me: { handle: 'Mac', builder: true, approver }, onExit() {}, rand: counting(),
    goTo: (p) => went.push(p), download: (name, bytes, type) => files.push({ name, bytes, type }),
  });
  document.body.append(panel.root);
  panel.setOn(true);
  await flush();
  return { panel, edit, svc, sha, root: panel.root, went, files };
}

test('POI-6 THE APPROVER\'S QUEUE: Approvals only for an approver; each submission with what it changes and the law\'s report; Look at it opens it in the editor and takes the eye there; the live one and the submission shown in turn where it stands; sent back only with a word; approved, the look closed (mutants: the queue for a builder; sent back without a word; before and after never swapped)', async () => {
  const builder = await panelOver({ approver: false });
  assert.equal(button(builder.root, 'Approvals'), undefined, 'a builder has no queue');
  builder.panel.destroy();
  const P = await panelOver();
  const id = 'poi-00000000beef';
  const live = docOf(id, { parts: [part('tower', P.sha, { materials: [{ ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }] })] });
  const sent = structuredClone(live);
  sent.name = 'Old tower, mended';
  sent.place.x += 10;
  P.svc.queue = [{ id, rev: 4, kind: 'doc', doc: sent, base: 3, author: 'Ann', at: 1, submittedAt: Date.now() / 1000 - 7200, liveRev: 3, liveDoc: live, stale: false }];
  button(P.root, 'Approvals').click();
  await until(() => !!P.panel.review.queue(), 'the queue listed');
  await flush();
  const dlg = P.panel.review.dialog();
  const texts = () => all(dlg).map((n) => n.textContent);
  assert.ok(texts().includes('a change · by Ann · sent 2 hours ago'));
  assert.ok(texts().includes('Renamed from "Old tower" to "Old tower, mended".'));
  assert.ok(texts().includes('Moved 10 m.'));
  await until(() => all(P.panel.review.dialog()).some((n) => n.textContent === 'Nothing wrong.'), 'the law\'s report, its assets known');
  // look: opened in the editor, the eye there
  button(P.panel.review.dialog(), 'Look at it').click();
  assert.equal(P.edit.docOf(id).name, 'Old tower, mended');
  assert.equal(P.edit.entryOf(id).state, 'submitted');
  assert.deepEqual(P.went.at(-1), sent.place);
  assert.equal(P.edit.overlay().get(id).doc.name, 'Old tower, mended');
  button(P.panel.review.dialog(), 'Show the live one').click();
  assert.equal(P.edit.overlay().get(id).doc.name, 'Old tower', 'the live one where it stands');
  button(P.panel.review.dialog(), 'Show the submission').click();
  assert.equal(P.edit.shownAs(id), undefined);
  assert.equal(P.edit.overlay().get(id).doc.name, 'Old tower, mended');
  // sent back only with a word
  button(P.panel.review.dialog(), 'Send back').click();
  await flush();
  assert.equal(P.svc.asks.filter((a) => a.path === '/v1/poi/review').length, 0, 'no word, not sent');
  const note = all(P.panel.review.dialog()).find((n) => n.tagName === 'TEXTAREA');
  note.value = 'The door faces the cliff.'; note.dispatch('input', {});
  button(P.panel.review.dialog(), 'Send back').click();
  await until(() => P.svc.asks.some((a) => a.path === '/v1/poi/review'), 'sent back');
  assert.deepEqual(P.svc.asks.find((a) => a.path === '/v1/poi/review').body, { id, rev: 4, verdict: 'reject', note: 'The door faces the cliff.' });
  await flush();
  assert.equal(P.edit.has(id), false, 'the look closed with the verdict');
  // approved
  button(P.panel.review.dialog(), 'Approve').click();
  await until(() => P.svc.asks.filter((a) => a.path === '/v1/poi/review').length === 2, 'approved');
  assert.equal(P.svc.asks.filter((a) => a.path === '/v1/poi/review')[1].body.verdict, 'approve');
  P.panel.destroy();
});

test('POI-6 A POI\'S HISTORY: every revision newest first with its state, author and word; an older one opened as a change to the live one; an approver puts an earlier approved one back, asked twice (mutants: opened as saved; put back at the first press)', async () => {
  const P = await panelOver();
  const id = 'poi-00000000beef';
  const r1 = docOf(id, { name: 'First', parts: [part('tower', P.sha, { materials: [{ ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }] })] });
  const r2 = { ...structuredClone(r1), name: 'Second' };
  P.svc.history.set(id, { id, liveRev: 2, revs: [
    { rev: 1, kind: 'doc', doc: r1, author: 'Ann', at: Date.now() / 1000 - 86400 * 3, state: 'approved', reviewer: 'Mac', note: 'Good.' },
    { rev: 2, kind: 'doc', doc: r2, author: 'Ann', at: Date.now() / 1000 - 60, state: 'approved', reviewer: 'Mac', note: null },
  ] });
  P.edit.open(id, { doc: r2, base: 2, rev: null, state: 'live' });
  P.edit.select({ id, part: null });
  await flush();
  button(P.root, 'History...').click();
  await until(() => all(P.panel.review.dialog() ?? { querySelectorAll: () => [] }).some((n) => n.textContent === 'Revision 1: First'), 'the history listed');
  const dlg = P.panel.review.dialog();
  const names = all(dlg).filter((n) => n.className === 'dfpoi-shelf-name').map((n) => n.textContent);
  assert.deepEqual(names, ['Revision 2: Second', 'Revision 1: First'], 'newest first');
  assert.ok(all(dlg).some((n) => n.textContent === 'Mac: Good.'));
  assert.ok(all(dlg).some((n) => n.textContent === 'approved · by Ann · 3 days ago'));
  // put back: asked twice
  const putBack = () => button(P.panel.review.dialog(), 'Put this one back') ?? button(P.panel.review.dialog(), 'Put it back in the world?');
  putBack().click();
  await flush();
  assert.equal(P.svc.asks.filter((a) => a.path === '/v1/poi/rollback').length, 0, 'asked first');
  // AUDIT POI T5: the history drawn again from the store's answer after the put-back - revision 1 the live one now. The
  // wait for an 'Open this one' was met at once by the dialog drawn before it, so no redraw was ever asked.
  P.svc.history.set(id, { ...P.svc.history.get(id), liveRev: 1 });
  const liveRow = () => all(P.panel.review.dialog() ?? { querySelectorAll: () => [] }).filter((n) => n.className === 'dfpoi-review')
    .find((row) => all(row).some((n) => n.textContent === 'In the world now.'));
  assert.ok(all(liveRow()).some((n) => n.textContent === 'Revision 2: Second'), 'revision 2 live before the put-back');
  button(P.panel.review.dialog(), 'Put it back in the world?').click();
  await until(() => P.svc.asks.some((a) => a.path === '/v1/poi/rollback'), 'put back');
  assert.deepEqual(P.svc.asks.find((a) => a.path === '/v1/poi/rollback').body, { id, rev: 1 });
  await until(() => /stands in the world again/.test(all(P.root).find((n) => n.className.includes('dfpoi-status')).textContent), 'said');
  await flush();
  assert.ok(all(liveRow()).some((n) => n.textContent === 'Revision 1: First'), 'drawn again: revision 1 in the world now');
  // the newer one opened: a change to the live one, to save
  const opens = all(P.panel.review.dialog()).filter((n) => n.tagName === 'BUTTON' && n.textContent === 'Open this one');
  opens[0].click();
  assert.equal(P.edit.docOf(id).name, 'Second');
  assert.equal(P.edit.dirty(id), true, 'a change to save, against the live one');
  assert.equal(P.edit.entryOf(id).base, 1);
  assert.deepEqual(P.went.at(-1), r2.place);
  P.panel.destroy();
});

test('POI-6 OUT AND BACK IN FROM THE PANEL: a POI\'s model saved as a .glb the importer reads; the open POIs packed into a .zip; that pack read back - shown, its assets uploaded, its POI opened as new where the store does not know it; a file that is no pack refused in words; the builder\'s unsaved changes never thrown away for a pack\'s (mutant: the pack overwrites them)', async () => {
  const P = await panelOver();
  const id = P.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Shrine' });
  P.edit.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: P.sha, submeshes: 2, name: 'Altar' })); });
  P.edit.select({ id, part: null });
  await flush();
  button(P.root, 'Export model (.glb)').click();
  await until(() => P.files.length === 1, 'the .glb saved');
  assert.equal(P.files[0].name, 'Shrine.glb');
  assert.equal(P.files[0].type, 'model/gltf-binary');
  assert.equal(bakeGltf(readGltf(P.files[0].bytes), { split: 'nodes' })[0].mesh.submeshes.length, 2);
  button(P.root, 'Export pack').click();
  await until(() => P.files.length === 2, 'the pack saved');
  assert.equal(P.files[1].name, 'Shrine.zip');
  assert.deepEqual(poiDocProblems((await readPack(await readZipEntries({ arrayBuffer: async () => P.files[1].bytes.slice().buffer }))).pois[0]), []);
  // read back into a fresh editor
  const Q = await panelOver();
  assert.equal(await Q.panel.openPack(new TextEncoder().encode('not a zip')), false);
  assert.match(all(Q.root).find((n) => n.className.includes('dfpoi-status')).textContent, /not a POI pack/);
  assert.equal(await Q.panel.openPack(P.files[1].bytes), true);
  assert.ok(all(Q.root).some((n) => n.textContent === '1 POI, 0 library entries, 1 model or picture.'));
  button(Q.root, 'Upload and open').click();
  await until(() => Q.edit.has(id), 'the POI opened');
  assert.ok(Q.svc.asks.some((a) => /^\/v1\/poi\/asset\/[0-9a-f]{64}\?kind=mesh$/.test(a.path) && a.method === 'PUT'));
  assert.equal(Q.edit.entryOf(id).state, 'new', 'the store does not know it: new');
  assert.equal(Q.edit.docOf(id).name, 'Shrine');
  // AUDIT POI T6: a POI opened new is unsaved whatever is done to it, so the pin below held for any POI open; and its
  // wait for the words was all that failed a pack that overwrote it (ten seconds on). Now: SAVED, the pack's is taken;
  // then CHANGED, the builder's is kept - each asked the moment the dialog closes.
  const imported = async () => {
    assert.equal(await Q.panel.openPack(P.files[1].bytes), true);
    button(Q.root, 'Upload and open').click();
    await until(() => !button(Q.root, 'Upload and open'), 'the pack imported');
  };
  const status = () => all(Q.root).find((n) => n.className.includes('dfpoi-status')).textContent;
  Q.edit.edit(id, 'rename', (d) => { d.name = 'Shrine, saved'; });
  Q.edit.markSaved(id, { rev: 1, state: 'draft' });
  await imported();
  assert.equal(Q.edit.docOf(id).name, 'Shrine', 'nothing unsaved: the pack\'s');
  assert.doesNotMatch(status(), /left as you had them/);
  // the builder's own unsaved changes are never thrown away for a pack's
  Q.edit.markSaved(id, { rev: 1, state: 'draft' });
  Q.edit.edit(id, 'rename', (d) => { d.name = 'Shrine, mine'; });
  const asked = Q.svc.asks.length;
  await imported();
  assert.ok(Q.svc.asks.length > asked);
  assert.equal(Q.edit.docOf(id).name, 'Shrine, mine');
  assert.match(status(), /left as you had them/);
  P.panel.destroy(); Q.panel.destroy();
});

test('POI-6 RECORDS: the world takes the eye to a place for the approver by the map\'s own door', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /function goTo\(place\) \{\n\s+if \(!place\) return;\n\s+_teleportToPixel\(place\.px, place\.py, \[place\.x, player\.pos\[1\] \+ 1, place\.z\], \{ grounded: true \}\)/);
  assert.match(world, /createPoiEditorPanel\(\{[^}]*decodeImage: decodePoiImage, goTo \}\)/);
});
