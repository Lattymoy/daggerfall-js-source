// AUDIT POI, the lead's (2026-10-15; bible/06-Systems/POI-Editor-Arc.md POI-4, POI-5, POI-6) - WHAT THE LANES LEFT TO
// THE MERGE: the joins between one lane's change and another's code, and the notes each lane left beside its own.
// Mac: "Audit everything. Ensure perfection."
//   - L1 a press holds the editor's docks until it ends (lane D's note: a field's change in the press's mousedown drew
//     the dock again and took the button from under the pointer);
//   - L2 the UV dialog unwraps off the page's thread (lane F's M13 wired to the panel), Apply waits for it, and an
//     unwrap still out when the dialog closes is let go - never run here after all;
//   - L3 the vertex mode lights the vertices selected, none when none is;
//   - L4 a pack opened through its bounded reader (lane G's readPackBytes, C6);
//   - L5 a pack the store refuses draws the law's problems in the pack dialog (C5);
//   - L6 a model whose objects outnumber a POI's parts is refused at "A part for each object", in words, the dialog
//     standing (lane E's note);
//   - L7 a model's lights listed, placed and kept with it (lane E's G7);
//   - L8 the mesh refusals a damaged file meets said as what they are;
//   - L9 the editor reads an asset's facts as the store's law does - its budgets' counts, box and bytes (lane A's S6);
//   - L10 a withdrawal the store closed 'withdrawn' (the builder's other draft open beside it, lane A's S8) leaves the
//     document a change to save over that draft;
//   - L11 a name tidied of every character the law refuses (lane A's S13), never cut through a pair;
//   - L12 a model read in steps (lane B's R8, its last whole task): the stand work's decode yields as its bakes do.
// Over the shared fake document (test/chargenDom.mjs), as test/poi/auditpoi_panels.test.js drives it.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPoiEditorPanel, createAssetFacts, PRESS_HOLD_MS } from '../../src/ui/poi/poiEditorPanel.js';
import { createPoiUvPanel } from '../../src/ui/poi/poiUvPanel.js';
import { createPoiEdit, newPart, newLight, lawName } from '../../src/poi/poiEdit.js';
import { encodePoiMesh, decodePoiMesh, decodePoiMeshSteps, poiMeshError, poiMeshFacts, meshBoxOf, POI_MESH_STEP } from '../../src/poi/poiMesh.js';
import { DEFAULT_MATERIAL, POI_LIMITS, POI_BUDGET, poiDocProblems } from '../../src/poi/poiLaw.js';
import { writePack, readPackBytes } from '../../src/poi/poiPack.js';
import { prepareImport, uploadImport } from '../../src/poi/poiImport.js';
import { writeGlb } from '../../src/poi/gltfExport.js';
import { readGltf, bakeGltf } from '../../src/poi/gltfImport.js';
import { handleUnwrap } from '../../src/poi/uv/uvUnwrapWorker.js';
import { gltfErrorText, meshErrorText, packErrorText, problemText, problemWhere } from '../../src/poi/poiText.js';

const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Wait until `cond` holds, `ms` at most. */
const until = async (cond, what, ms = 10000) => { const end = Date.now() + ms; while (!cond()) { if (Date.now() > end) assert.fail(`never: ${what}`); await sleep(1); } };
const counting = () => { let n = 0; return (b) => { for (let i = 0; i < b.length; i++) b[i] = (n + i) & 255; n++; return b; }; };
const all = (root) => root.querySelectorAll('*');
const button = (root, text) => all(root).find((n) => n.tagName === 'BUTTON' && n.textContent === text);
/** A press as a browser makes it: the control takes the focus on its mousedown, then the click. */
const press = (b) => { assert.ok(b, 'a control to press'); b.focus(); b.click(); };
const quad = () => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
  uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
  indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
  submeshes: [{ start: 0, count: 6 }],
});
const partOf = (sha, key = 'tower') => ({ key, name: key, mesh: sha, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true, materials: [{ ...DEFAULT_MATERIAL }] });
const docOf = (sha, name) => ({ v: 1, id: 'poi-00000000beef', name, place: { px: 200, py: 210, x: 100, z: 200, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1 }, parts: [partOf(sha)], lights: [], marker: { show: false } });
const glbPart = (key, tt = [0, 0, 0]) => ({ key, name: key, mesh: quad(), t: tt, r: [0, 0, 0, 1], s: [1, 1, 1], materials: [{ ...DEFAULT_MATERIAL }] });

/** The store, faked: what was asked, and its answers - `hold` a promise each ask waits on, in turn; `answer` a route's
 *  own answer (`{ [method path]: () => response }`). */
function store() {
  const s = { asks: [], hold: [], answer: {}, draftRev: 2 };
  const ok = (data) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => data });
  const no = (error, status = 409, extra = {}) => ({ ok: false, status, headers: { get: () => null }, json: async () => ({ error, ...extra }) });
  s.no = no;
  s.fetch = async (url, init = {}) => {
    const path = url.replace('https://svc', '');
    const method = init.method ?? 'GET';
    const body = init.body === undefined ? undefined : typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    s.asks.push({ path, method, body });
    if (s.hold.length) await s.hold.shift();
    if (s.answer[`${method} ${path}`]) return s.answer[`${method} ${path}`]();
    if (path === '/v1/poi/draft') return ok({ id: body.doc.id, rev: ++s.draftRev, state: 'draft' });
    if (path === '/v1/poi/submit') return ok({ id: body.id, rev: body.rev, state: 'submitted' });
    if (path === '/v1/poi/withdraw') return ok({ id: body.id, rev: body.rev, state: 'draft' });
    if (path === '/v1/poi/list') return ok({ pois: [] });
    if (path === '/v1/poi/shelf' && method === 'GET') return ok({ items: [] });
    if (path === '/v1/poi/shelf') return ok({ id: body.item.id, at: 1 });
    const a = /^\/v1\/poi\/asset\/([0-9a-f]{64})\?kind=(mesh|texture)$/.exec(path);
    if (a) return ok({ sha: a[1], kind: a[2], meta: a[2] === 'mesh' ? { submeshes: 1 } : { w: 1, h: 1 }, existed: false });
    return no('not-found', 404);
  };
  s.count = (path, method = null) => s.asks.filter((x) => x.path === path && (!method || x.method === method)).length;
  return s;
}
const editorStub = () => { const e = { calls: [] }; return Object.assign(e, { mode: () => 'move', setMode() {}, space: () => 'world', setSpace() {}, snapOn: () => false, setSnap() {}, snapSteps: () => ({ move: 0.25, turn: 15, size: 0.1 }), eyeSpeed: () => 12, placeNew() {}, placeAsset: (a, n) => e.calls.push(['placeAsset', a, n]) }); };

async function over() {
  const meshBytes = encodePoiMesh(quad());
  const sha = await sha256(meshBytes);
  const svc = store();
  const edit = createPoiEdit({ rand: counting() });
  const editor = editorStub();
  const feed = { asset: async (h) => { if (h !== sha) throw new Error('poi asset: 404'); return meshBytes; }, refresh() {} };
  const panel = createPoiEditorPanel({
    doc: document, edit, editor, feed, io: () => ({ fetch: svc.fetch, base: 'https://svc', secret: 'tok' }), me: { handle: 'Mac', builder: true, approver: false }, onExit() {}, rand: counting(),
    goTo() {}, download() {},
  });
  document.body.append(panel.root);
  panel.setOn(true);
  await flush();
  return { panel, edit, editor, svc, sha, meshBytes, root: panel.root };
}
const rightOf = (P) => all(P.root).find((n) => n.className === 'dfpoi-dock dfpoi-right');
const statusOf = (P) => all(P.root).find((n) => n.className.includes('dfpoi-status')).textContent;
const held = (svc) => { let open; svc.hold.push(new Promise((r) => { open = r; })); return () => open(); };
/** The import dialog, its file chosen. */
async function imported(P, glb) {
  press(button(P.root, 'Import model'));
  const dlg = all(P.root).find((n) => n.className === 'dfpoi-dialog');
  const input = all(dlg).find((n) => n.tagName === 'INPUT' && n.type === 'file');
  input.files = [{ name: 'model.glb', arrayBuffer: async () => glb.slice().buffer }];
  input.dispatch('change', {}); await flush();
  return dlg;
}
document.activeElement = document.body;

// ── L1: A PRESS HOLDS THE DOCKS ───────────────────────────────────────

test('AUDIT POI L1 A PRESS HOLDS THE DOCKS UNTIL IT ENDS: a name typed, then Save pressed - the field\'s change in the press\'s mousedown draws nothing under the pointer, so the button pressed is the one there at its release (its click comes), and the dock is drawn again just after; a release never heard holds it PRESS_HOLD_MS at most; a panel destroyed draws nothing more (mutants: the press unheard; the release unheard; the hold unbounded; the destroyed panel drawn)', async () => {
  const P = await over();
  try { await pressHeld(P); } finally { P.panel.destroy(); }
});
async function pressHeld(P) {
  const id = P.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Camp' });
  P.edit.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: P.sha, submeshes: 1, name: 'Hut' })); });
  P.edit.select({ id, part: null });
  await until(() => all(rightOf(P)).some((n) => n.textContent === 'Nothing. It can be saved.'), 'its model known');
  const name = all(rightOf(P)).find((n) => n.tagName === 'INPUT' && n.value === 'Camp');
  name.focus(); name.value = 'Camp on the ridge';
  const save = button(rightOf(P), 'Save draft (Ctrl+S)');
  // the press: its pointerdown (the root's capture), the field's change as the focus leaves it, a turn of the page
  P.root.dispatch('pointerdown', {});
  name.dispatch('change', {});
  save.focus();
  await flush(); await sleep(5); await flush();
  assert.equal(P.edit.docOf(id).name, 'Camp on the ridge', 'the field\'s change taken');
  assert.ok(rightOf(P).contains(save), 'the button under the pointer is still the one there');
  P.root.dispatch('pointerup', {});
  save.click();
  await until(() => P.svc.count('/v1/poi/draft', 'PUT') === 1, 'saved by the one press');
  await sleep(5); await flush();
  assert.equal(rightOf(P).contains(save), false, 'the dock drawn again just after the release');
  // a release never heard (let go outside the window): held no longer than PRESS_HOLD_MS
  const save2 = button(rightOf(P), 'Save draft (Ctrl+S)');
  const at = Date.now();
  P.root.dispatch('pointerdown', {});
  P.edit.edit(id, 'rename', (d) => { d.name = 'Camp'; });
  await flush();
  assert.ok(rightOf(P).contains(save2), 'held while pressed');
  await until(() => !rightOf(P).contains(save2), 'drawn again, unreleased', 3 * PRESS_HOLD_MS);
  const took = Date.now() - at;
  assert.ok(took >= PRESS_HOLD_MS - 20 && took < PRESS_HOLD_MS + 500, `drawn again after ${took} ms`);
  // destroyed while a press holds it: its release draws nothing into the panel let go of
  const save3 = button(rightOf(P), 'Save draft (Ctrl+S)');
  const dock = rightOf(P);
  P.root.dispatch('pointerdown', {});
  P.edit.edit(id, 'rename', (d) => { d.name = 'Camp by the road'; });
  await flush();
  P.panel.destroy();
  P.root.dispatch('pointerup', {});
  await sleep(5); await flush();
  assert.ok(dock.contains(save3), 'nothing drawn after it was destroyed');
}

// ── L2, L3: THE UV DIALOG ─────────────────────────────────────────────

/** A sheet of n by n unit squares on the ground, its UVs skewed (an unwrap lays them square again). */
function sheet(n) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { pos.push(i, 0, j); uv.push(i * 0.05 + j * 0.03, j * 0.08); }
  const at = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) idx.push(at(i, j), at(i + 1, j + 1), at(i + 1, j), at(i, j), at(i, j + 1), at(i + 1, j + 1));
  const V = pos.length / 3;
  return { positions: Float32Array.from(pos), normals: new Float32Array(V * 3), uvs: Float32Array.from(uv), indices: Uint32Array.from(idx), submeshes: [{ start: 0, count: idx.length }] };
}
/** The page's Worker, faked: the real worker's handler behind a gate the test opens. */
function workers() {
  const made = [];
  let gate = null;
  const W = function FakeWorker(url, opts) {
    const w = {
      url: String(url), opts, unwraps: 0, terminated: 0, onmessage: null, onerror: null,
      postMessage(msg) {
        if (msg.t === 'unwrap') w.unwraps++;
        const go = () => handleUnwrap(msg, (reply) => w.onmessage?.({ data: reply }));
        if (msg.t === 'unwrap' && gate) gate.then(go); else queueMicrotask(go);
      },
      terminate() { w.terminated++; },
    };
    made.push(w);
    return w;
  };
  return { W, made, hold: () => { let open; gate = new Promise((r) => { open = r; }); return () => { gate = null; open(); }; } };
}
const uvButton = (dlg, text) => dlg.root.querySelectorAll('button').find((n) => n.textContent === text);

test('AUDIT POI L2 THE UV DIALOG UNWRAPS OFF THE PAGE\'S THREAD: Unwrap says it is working and goes to the worker, once however often it is pressed; Apply waits for it (held, and does nothing pressed); the answer lands as one step, said; Apply then hands it over and the worker is let go; Cancel while one is out lets the worker go and lays NOTHING - the unwrap never run here instead (mutants: the unwrap on this thread; Apply unheld; Apply\'s press unguarded; the worker kept at close; the answer said after close; the let-go unwrap run here)', async () => {
  const F = workers();
  const was = globalThis.Worker;
  globalThis.Worker = F.W;
  try {
    const applied = [];
    let closes = 0;
    const dlg = createPoiUvPanel({ doc: document, mesh: sheet(4), materials: 1, title: 'Sheet', onApply: (r) => { applied.push(r); return true; }, onClose: () => { closes++; } });
    const apply = uvButton(dlg, 'Apply to the part');
    const open = F.hold();
    uvButton(dlg, 'Unwrap').click();
    assert.match(dlg.root.textContent, /Unwrapping\.\.\./);
    await flush();
    assert.equal(F.made.length, 1, 'a worker of its own');
    assert.match(F.made[0].url, /uvUnwrapWorker\.js$/);
    assert.equal(dlg.edit.busy(), true, 'out on the worker');
    uvButton(dlg, 'Unwrap').click(); await flush();
    assert.equal(F.made[0].unwraps, 1, 'pressed again while out: one unwrap');
    assert.equal(apply.disabled, true, 'Apply held while it works');
    apply.disabled = false; apply.click();
    assert.equal(applied.length, 0, 'pressed anyway, it hands over nothing - never the UVs from before');
    const before = Float64Array.from(dlg.edit.session.cornerUv);
    open();
    await until(() => !dlg.edit.busy(), 'answered'); await flush();
    assert.match(dlg.root.textContent, /Unwrapped 1 island\./);
    assert.notDeepEqual([...dlg.edit.session.cornerUv], [...before], 'laid');
    assert.equal(apply.disabled, false);
    dlg.edit.undo();
    assert.deepEqual([...dlg.edit.session.cornerUv], [...before], 'as one step');
    dlg.edit.redo();
    apply.click(); await flush();
    assert.equal(applied.length, 1);
    assert.equal(closes, 1);
    assert.equal(F.made[0].terminated, 1, 'the worker let go with the dialog');

    // closed while one is out
    const second = createPoiUvPanel({ doc: document, mesh: sheet(4), materials: 1, title: 'Sheet', onApply: () => true, onClose() {} });
    const untouched = Float64Array.from(second.edit.session.cornerUv);
    const open2 = F.hold();
    uvButton(second, 'Unwrap').click();
    await flush();
    assert.equal(second.edit.busy(), true);
    uvButton(second, 'Cancel').click();
    assert.equal(F.made[1].terminated, 1, 'its worker let go at once');
    await flush(); open2(); await flush(); await sleep(5);
    assert.equal(second.edit.busy(), false);
    assert.deepEqual([...second.edit.session.cornerUv], [...untouched], 'nothing laid - the unwrap never ran here');
    assert.equal(second.edit.canUndo(), false, 'no step');
    assert.match(second.root.textContent, /Unwrapping\.\.\./, 'nothing said after it closed');
    assert.equal(await second.edit.unwrapOffThread(), 0, 'let go, it unwraps no more');
    assert.equal(F.made.length, 2, 'and starts no worker');
  } finally {
    if (was === undefined) delete globalThis.Worker; else globalThis.Worker = was;
  }
});

test('AUDIT POI L3 THE VERTEX MODE LIGHTS THE VERTICES SELECTED - none when none is (the tools read an empty selection as the whole material; the light read it so too and lit every vertex) (mutant: lit by the tools\' corners)', () => {
  const proto = Object.getPrototypeOf(document.createElement('canvas'));
  const was = proto.getContext;
  const lit = [];
  proto.getContext = function getContext(...args) {
    const base = was.apply(this, args), own = {};
    return new Proxy(own, {
      get: (o, k) => (k in o ? o[k] : k === 'fillRect' ? (x, y) => { if (o.fillStyle === '#ffb43c') lit.push([x, y]); } : base[k]),
      set: (o, k, v) => { o[k] = v; return true; },
    });
  };
  try {
    const dlg = createPoiUvPanel({ doc: document, mesh: sheet(2), materials: 1, title: 'Sheet', onApply: () => true, onClose() {} });
    dlg.edit.setMode('vertex');
    lit.length = 0; dlg.draw();
    assert.equal(lit.length, 0, 'nothing selected, nothing lit');
    const c = dlg.edit.session.cornerUv;
    assert.ok(dlg.edit.pick(c[0], c[1], 1e-4) !== false);
    assert.equal(dlg.edit.selection().size, 1);
    lit.length = 0; dlg.draw();
    assert.ok(lit.length >= 1 && lit.length < dlg.edit.session.cornerUv.length / 2, `the one vertex's corners lit (${lit.length})`);
  } finally { proto.getContext = was; }
});

// ── L4, L5: A PACK ────────────────────────────────────────────────────

/** A zip as an archiver might write it: each entry stored (method 0) or deflated (8), its declared size as given
 *  (test/poi/auditpoi_packs.test.js's). */
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
  const out = new Uint8Array([...parts, ...cds, eocd].reduce((a, p) => a + p.length, 0));
  let p = 0;
  for (const x of [...parts, ...cds, eocd]) { out.set(x, p); p += x.length; }
  return out;
}
/** Bytes no inflater takes: an entry whose bytes are these is never inflated, or the read throws. */
const NOT_DEFLATE = Uint8Array.from([0xff, 0xff, 0xff, 0xff]);

test('AUDIT POI L4 A PACK OPENED THROUGH ITS BOUNDED READER: a file in it nothing names is never inflated (the whole-archive read threw on it, and the pack was "not a pack"); a model declaring more than a model may be is refused in the pack\'s own word before a byte of it is inflated (mutant: openPack inflating the whole archive again)', async () => {
  const P = await over();
  const head = new TextEncoder().encode(JSON.stringify({ v: 1, kind: 'poi-pack', pois: [docOf(P.sha, 'Tower')], shelf: [] }));
  const junky = zipOf([{ name: 'pack.json', data: head }, { name: `assets/${P.sha}.mesh`, data: P.meshBytes }, { name: 'readme.bin', data: NOT_DEFLATE, method: 8, size: 256 * 1024 * 1024 }]);
  assert.equal(await P.panel.openPack(junky), true, statusOf(P));
  assert.ok(button(P.root, 'Upload and open'));
  press(button(P.root, 'Cancel'));
  const bomb = zipOf([{ name: 'pack.json', data: head }, { name: `assets/${P.sha}.mesh`, data: NOT_DEFLATE, method: 8, size: 64 * 1024 * 1024 }]);
  assert.equal(await P.panel.openPack(bomb), false);
  assert.equal(statusOf(P), packErrorText({ code: 'pack-too-large' }));
  P.panel.destroy();
});

test('AUDIT POI L5 A PACK THE STORE REFUSES, ITS PROBLEMS SHOWN: the law\'s problems the store answered with are drawn in the pack dialog under its word and where, each where it is (mutants: the problems left undrawn; the service dropping them)', async () => {
  const P = await over();
  const entry = { v: 1, id: 'lib-00000000cafe', name: 'Tower', parts: [partOf(P.sha)], lights: [], thumb: null };
  const { bytes } = writePack({ pois: [docOf(P.sha, 'Tower')], shelf: [entry], assets: new Map([[P.sha, P.meshBytes]]) });
  const problems = [{ path: 'parts[0].materials', code: 'material-count', have: 3, want: 1 }, { path: 'name', code: 'name-length' }];
  P.svc.answer['PUT /v1/poi/shelf'] = () => P.svc.no('poi-doc', 400, { problems });
  assert.equal(await P.panel.openPack(bytes), true);
  press(button(P.root, 'Upload and open'));
  const lines = problems.map((p) => (problemWhere(p.path, entry) ? `${problemWhere(p.path, entry)}: ${problemText(p)}` : problemText(p)));
  assert.equal(lines[0].startsWith('Part tower: '), true, lines[0]);
  await until(() => lines.every((line) => all(P.root).some((n) => n.className === 'dfpoi-problem' && n.textContent === line)), 'each problem drawn');
  assert.ok(all(P.root).some((n) => n.className === 'dfpoi-problem' && n.textContent.startsWith('Tower: ')), 'under its word and where');
  P.panel.destroy();
});

// ── L6, L7: THE IMPORT ────────────────────────────────────────────────

/** A .glb of `n` objects, each the same one-material model (writeGlb's of one part, its node copied along x). */
function objects(n) {
  const one = writeGlb({ name: 'Village', parts: [glbPart('hut')], lights: [], pictures: new Map() });
  const dv = new DataView(one.buffer, one.byteOffset, one.byteLength);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(one.subarray(20, 20 + jsonLen)));
  const bin = one.subarray(20 + jsonLen);
  const { children, matrix, rotation, scale, ...node } = json.nodes.find((x) => x.mesh !== undefined);
  json.nodes = Array.from({ length: n }, (_, i) => ({ ...structuredClone(node), name: `hut${i}`, translation: [i * 2, 0, 0] }));
  json.scenes[0].nodes = json.nodes.map((_, i) => i);
  let text = new TextEncoder().encode(JSON.stringify(json));
  if (text.length % 4) text = Uint8Array.from([...text, ...new Array(4 - (text.length % 4)).fill(0x20)]);
  const out = new Uint8Array(12 + 8 + text.length + bin.length);
  const o = new DataView(out.buffer);
  o.setUint32(0, 0x46546c67, true); o.setUint32(4, 2, true); o.setUint32(8, out.length, true);
  o.setUint32(12, text.length, true); o.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20); out.set(bin, 20 + text.length);
  return out;
}

test('AUDIT POI L6 A MODEL OF MORE OBJECTS THAN A POI HAS PARTS: "A part for each object" refuses it in words - the place button held, the dialog standing, nothing thrown out of the list - and "One part" makes it again; the bake refuses it with its numbers; at the bound it is made (mutants: the bound unasked - parts the law refuses at the save; the list\'s change read outside the refusal)', async () => {
  const many = objects(POI_LIMITS.parts + 1);
  const model = readGltf(many);
  assert.equal(model.instances.length, POI_LIMITS.parts + 1);
  assert.throws(() => bakeGltf(model, { split: 'nodes' }), (e) => e.code === 'too-many-parts' && e.args.n === POI_LIMITS.parts + 1 && e.args.max === POI_LIMITS.parts);
  assert.equal(gltfErrorText('too-many-parts', { n: 129, max: 128 }), 'This model has 129 objects, and a POI holds at most 128 parts. Make it one part, or import it in pieces.');
  assert.doesNotThrow(() => bakeGltf(readGltf(objects(POI_LIMITS.parts)), { split: 'nodes' }), 'at the bound: made');

  const P = await over();
  const dlg = await imported(P, many);
  const placeBtn = button(dlg, 'Upload and place');
  assert.equal(placeBtn.disabled, false, 'one part: made');
  const split = all(dlg).find((n) => n.tagName === 'SELECT');
  split.value = 'nodes'; split.dispatch('change', {});
  assert.ok(all(dlg).some((n) => n.className === 'dfpoi-problem' && n.textContent === gltfErrorText('too-many-parts', { n: POI_LIMITS.parts + 1, max: POI_LIMITS.parts })), all(dlg).map((n) => n.textContent).join(' | '));
  assert.equal(placeBtn.disabled, true, 'nothing to place');
  assert.ok(P.root.contains(dlg), 'the dialog standing');
  split.value = 'whole'; split.dispatch('change', {});
  assert.equal(placeBtn.disabled, false, 'made again as one part');
  P.panel.destroy();
});

test('AUDIT POI L7 A MODEL\'S LIGHTS COME WITH IT: the import lists them, places them with it, and keeps them with it in the library (they were left behind: `lights: []`) (mutants: the lights unlisted; kept without them)', async () => {
  const P = await over();
  const glb = writeGlb({ name: 'Lamp', parts: [glbPart('post')], lights: [newLight([1, 2, 3])], pictures: new Map() });
  const dlg = await imported(P, glb);
  assert.ok(all(dlg).some((n) => n.textContent === '1 light, placed with it'), all(dlg).map((n) => n.textContent).join(' | '));
  press(button(dlg, 'Upload and place'));
  await until(() => P.editor.calls.length > 0, 'placed');
  await until(() => P.svc.count('/v1/poi/shelf', 'PUT') === 1, 'kept');
  const placed = P.editor.calls[0][1];
  assert.equal(placed.lights.length, 1);
  assert.deepEqual(placed.lights[0].t, [1, 2, 3], 'where it stood');
  const kept = P.svc.asks.find((x) => x.path === '/v1/poi/shelf' && x.method === 'PUT').body.item;
  assert.deepEqual(kept.lights, placed.lights, 'kept with it');
  P.panel.destroy();
});

// ── L8: THE WORDS ─────────────────────────────────────────────────────

test('AUDIT POI L8 A DAMAGED MODEL SAID AS WHAT IT IS: a number that is no number, and a vertex named that is not there, each in its own words - not "malformed" (mutant: the words unsaid)', () => {
  const nan = quad(); nan.positions[4] = NaN;
  assert.equal(poiMeshError(nan), 'not-finite');
  const far = quad(); far.indices[2] = 9;
  assert.equal(poiMeshError(far), 'index-range');
  assert.equal(meshErrorText('not-finite'), 'A part\'s model holds an invalid number (NaN or infinity). Export it again.');
  assert.equal(meshErrorText('index-range'), 'A part\'s model names a vertex it does not have. Export it again.');
});

// ── L9, L10, L11: LANE A'S STORE, JOINED ──────────────────────────────

const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));

test('AUDIT POI L9 THE EDITOR READS AN ASSET AS THE STORE\'S LAW DOES: a model\'s counts, box and bytes and a picture\'s size and bytes, learnt from its bytes, from an upload\'s answer and from a pack - so a POI over a budget is said in the inspector before the store refuses it (mutants: a model\'s facts its submeshes alone; a picture\'s bytes unread; the import\'s facts without their bytes; a pack\'s model without its facts)', async () => {
  const meshBytes = encodePoiMesh(quad());
  const mesh = decodePoiMesh(meshBytes).mesh;
  const want = { kind: 'mesh', ...poiMeshFacts(mesh), bytes: meshBytes.byteLength };
  const learnt = createAssetFacts(async (sha) => (sha === 'm'.repeat(64) ? meshBytes : PNG));
  learnt.of('m'.repeat(64)); learnt.of('p'.repeat(64)); await flush();
  assert.deepEqual(learnt.of('m'.repeat(64)), want, 'from its bytes');
  assert.deepEqual(learnt.of('p'.repeat(64)), { kind: 'texture', w: 1, h: 1, bytes: PNG.byteLength });
  // an import's answer: the store's meta and the bytes put
  const model = readGltf(writeGlb({ name: 'Post', parts: [glbPart('post')], lights: [], pictures: new Map() }));
  const prep = prepareImport(model, bakeGltf(model, { split: 'whole' }));
  const up = await uploadImport(prep, async (bytes, kind) => ({ ok: true, data: { sha: 'u'.repeat(64), kind, meta: poiMeshFacts(decodePoiMesh(bytes).mesh) } }));
  assert.equal(up.metas.get('u'.repeat(64)).bytes, prep.parts[0].bytes.byteLength, 'the import\'s facts carry the bytes put');
  const pictured = { name: 'Sign', lights: [], images: [{ name: 'sign', bytes: PNG }], parts: [{ name: 'sign', bytes: meshBytes, submeshes: 1, position: [0, 0, 0], materials: [{ ...DEFAULT_MATERIAL, texture: 0, emissive: null }] }] };
  const up2 = await uploadImport(pictured, async (bytes, kind) => ({ ok: true, data: { sha: (kind === 'mesh' ? 'u' : 'v').repeat(64), kind, meta: kind === 'mesh' ? poiMeshFacts(decodePoiMesh(bytes).mesh) : { w: 1, h: 1 } } }));
  assert.equal(up2.metas.get('v'.repeat(64)).bytes, PNG.byteLength, 'a picture\'s too');
  // a pack's: as the store's law reads them
  const sha = await sha256(meshBytes);
  const pack = await readPackBytes(writePack({ pois: [docOf(sha, 'Tower')], shelf: [], assets: new Map([[sha, meshBytes]]) }).bytes);
  assert.ok(pack.ok, JSON.stringify(pack));
  const { bytes: held, ...facts } = pack.assets.get(sha);
  assert.deepEqual({ ...facts, bytes: held.byteLength }, want);
  // every fact the panel is told carries the bytes the budget reads: a picture put, a UV edit put, a pack's (its own
  // bytes beside its facts), an import's (its metas, above) - by source, the bytes being read by the budget alone
  const panelSrc = readFileSync(new URL('../../src/ui/poi/poiEditorPanel.js', import.meta.url), 'utf8');
  const told = [...panelSrc.matchAll(/facts\.put\(([^\n]*)\);/g)].map((m) => m[1]);
  assert.deepEqual(told, [
    "r.data.sha, { kind: 'texture', ...r.data.meta, bytes: bytes.byteLength }",
    "r.data.sha, { kind: 'mesh', ...r.data.meta, bytes: out.byteLength }",
    'sha, { ...a, bytes: bytes.byteLength }',
    'sha, meta',
  ]);
  // the inspector: a part stood 3 km out reaches past the budget, said before any save
  const P = await over();
  try {
    const id = P.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Far' });
    P.edit.edit(id, 'add part', (d) => { d.parts.push({ ...newPart(d, { mesh: P.sha, submeshes: 1, name: 'Hut' }), t: [3000, 0, 0] }); });
    P.edit.select({ id, part: null });
    await until(() => all(rightOf(P)).some((n) => /reaches too far from its place/.test(n.textContent)), 'the budget said');
    assert.ok(3000 > POI_BUDGET.reach);
  } finally { P.panel.destroy(); }
});

test('AUDIT POI L10 A WITHDRAWAL THE STORE CLOSES \'withdrawn\': the builder\'s other draft of it is open beside it (saved from another window), so the document is a draft whose every change is still to save, its revision the store\'s to say - a save puts it over that draft (mutant: read as taken back to its own revision, nothing to save)', async () => {
  const P = await over();
  try {
    const id = P.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Camp' });
    P.edit.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: P.sha, submeshes: 1, name: 'Hut' })); });
    P.edit.select({ id, part: null });
    await until(() => all(rightOf(P)).some((n) => n.textContent === 'Nothing. It can be saved.'), 'its model known');
    press(button(rightOf(P), 'Save draft (Ctrl+S)'));
    await until(() => P.edit.entryOf(id).state === 'draft', 'saved'); await flush();
    press(button(rightOf(P), 'Send for approval'));
    await until(() => P.edit.entryOf(id).state === 'submitted', 'sent'); await flush();
    P.svc.answer['POST /v1/poi/withdraw'] = () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ id, rev: 3, state: 'withdrawn' }) });
    press(button(rightOf(P), 'Take back to draft'));
    await until(() => P.edit.entryOf(id).state === 'draft', 'taken back'); await flush();
    assert.equal(P.edit.entryOf(id).rev, null, 'its revision the store\'s to say');
    assert.equal(P.edit.dirty(id), true, 'the document a change to save');
    assert.equal(statusOf(P), 'Taken back. You had another draft of it saved: save to put this one in its place.');
    press(button(rightOf(P), 'Save draft (Ctrl+S)'));
    await until(() => P.edit.entryOf(id).rev === 4, 'saved over the draft');
    assert.equal(P.edit.dirty(id), false);
  } finally { P.panel.destroy(); }
});

test('AUDIT POI L11 A NAME TIDIED AS THE LAW READS IT: the separators, the bidirectional controls and a lone half of a pair made spaces, and the cut to its length never leaving half a pair - each tidied name one the law takes (mutants: the old control range alone; the cut through a pair)', () => {
  const law = (name) => poiDocProblems({ v: 1, id: 'poi-00000000beef', name, place: { px: 1, py: 1, x: 0, z: 0, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1 }, parts: [partOf('a'.repeat(64))], lights: [], marker: { show: false } }).filter((p) => p.path === 'name');
  for (const raw of ['Tower\u202eof\u2028Lies', 'Tower\u2066of\u2029Lies', 'Tower\ud800of Lies', 'Tower\u0085of Lies']) {
    assert.equal(lawName(raw), 'Tower of Lies', JSON.stringify(raw));
    assert.deepEqual(law(lawName(raw)), [], JSON.stringify(raw));
    assert.notDeepEqual(law(raw), [], `the law refuses ${JSON.stringify(raw)} untidied`);
  }
  const long = `${'a'.repeat(POI_LIMITS.name - 1)}\u{1f3f0}`;
  assert.equal(lawName(long), 'a'.repeat(POI_LIMITS.name - 1), 'the castle left out whole, not halved');
  assert.deepEqual(law(lawName(long)), []);
});

// ── L12: A MODEL READ IN STEPS ────────────────────────────────────────

test('AUDIT POI L12 A MODEL IS READ IN STEPS: the stand work\'s decode yields every POI_MESH_STEP numbers - its copies, its checks and its box - and answers what the whole read answers, every refusal too; the box true whatever step its corners fall in; the host reads it so (mutants: the checks one step; the box one step; a step reading only its first number; the host reading it whole)', () => {
  const n = 256;   // a sheet of 256 x 256 vertices
  const pos = [], uv = [], idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { pos.push(i * 0.1, 0, j * 0.1); uv.push(i / n, j / n); }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i; idx.push(a, a + n + 1, a + 1, a, a + n, a + n + 1); }
  const V = pos.length / 3;
  const big = { positions: Float32Array.from(pos), normals: new Float32Array(V * 3).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), uvs: Float32Array.from(uv), indices: Uint32Array.from(idx), submeshes: [{ start: 0, count: idx.length }] };
  const bytes = encodePoiMesh(big);
  const drive = (g) => { let steps = 0; for (;;) { const r = g.next(); if (r.done) return { value: r.value, steps }; steps++; } };
  const { value, steps } = drive(decodePoiMeshSteps(bytes));
  assert.deepEqual(value, decodePoiMesh(bytes), 'what the whole read answers');
  // three between its copies; a step for every POI_MESH_STEP numbers each check reads; a yield between the box's steps
  const per = (len) => Math.ceil(len / POI_MESH_STEP);
  assert.ok(per(V * 3) > 1 && per(idx.length) > 1, 'a mesh of many steps');
  assert.equal(steps, 3 + per(V * 3) * 2 + per(V * 2) + per(V * 3) + per(idx.length) + (per(V * 3 - 3) - 1));
  // the box: its corners in the last step and the first
  const p = new Float32Array(3 * (POI_MESH_STEP + 7)).fill(1);
  p[p.length - 2] = 9; p[1] = -4; p[p.length - 6] = -3;
  assert.deepEqual(meshBoxOf(p), [[-3, -4, 1], [1, 9, 1]]);
  // every refusal the whole read's - a number that is no number mid-step, an index past the vertices in the last step
  const nan = structuredClone(big); nan.normals[POI_MESH_STEP + 5] = NaN;
  assert.equal(poiMeshError(nan), 'not-finite');
  const far = structuredClone(big); far.indices[idx.length - 2] = V;
  assert.equal(poiMeshError(far), 'index-range');
  const out = structuredClone(big); out.positions[POI_MESH_STEP + 4] = 3000;
  assert.equal(poiMeshError(out), 'too-large');
  // the host reads it in steps (scenes/poiHost.js loadSteps)
  const host = readFileSync(new URL('../../src/scenes/poiHost.js', import.meta.url), 'utf8');
  assert.match(host, /const d = yield\* decodePoiMeshSteps\(yield feed\.asset\(part\.mesh, \{ auth: auth\(\) \}\)\);/);
});
