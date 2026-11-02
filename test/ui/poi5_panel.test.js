// POI-5 (2026-10-14; bible/06-Systems/POI-Editor-Arc.md) - THE MATERIAL EDITOR AND THE UV EDITOR'S PANEL.
// Mac, asked what "UV map" covers: "Full UV editor".
//   - the material editor (src/ui/poi/poiEditorPanel.js): a picture taken from a file - read by its header, refused in words
//     when it is not one, uploaded by its name and worn as one step; the glow's colour and strength; where the picture
//     lies (its offset, repeats and turn);
//   - the UV editor's panel (src/ui/poi/poiUvPanel.js): its view (UV to the canvas and back, a zoom that keeps the point
//     under the pointer); a click takes the face under it, a drag from empty space a box, the keys its modes; Apply
//     uploads the mesh made again and the part wears it as one step.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPoiEditorPanel } from '../../src/ui/poi/poiEditorPanel.js';
import { uvView } from '../../src/ui/poi/poiUvPanel.js';
import { createPoiEdit, newPart } from '../../src/poi/poiEdit.js';
import { encodePoiMesh, decodePoiMesh } from '../../src/poi/poiMesh.js';

const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
/** Wait until `cond` holds - an upload hashes its bytes off the main thread (crypto.subtle), so no count of turns of
 *  the loop is sure to outlast it on a loaded machine. */
const until = async (cond, what) => { const end = Date.now() + 10000; while (!cond()) { if (Date.now() > end) assert.fail(`never: ${what}`); await new Promise((r) => setTimeout(r, 1)); } };
const counting = () => { let n = 0; return (b) => { for (let i = 0; i < b.length; i++) b[i] = (n + i) & 255; n++; return b; }; };
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
/** A quad of two triangles, each its own material - UVs the whole square. */
const quad = () => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
  uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
  indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
  submeshes: [{ start: 0, count: 3 }, { start: 3, count: 3 }],
});

function store() {
  const s = { asks: [], refuse: null };
  s.fetch = async (url, init = {}) => {
    const path = url.replace('https://svc', '');
    s.asks.push({ path, method: init.method ?? 'GET', body: init.body });
    if (s.hold?.length) await s.hold.shift();
    if (s.refuse) return { ok: false, status: 429, headers: { get: () => null }, json: async () => ({ error: s.refuse }) };
    const m = /^\/v1\/poi\/asset\/([0-9a-f]{64})\?kind=(mesh|texture)$/.exec(path);
    if (m) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ sha: m[1], kind: m[2], meta: m[2] === 'mesh' ? { submeshes: 2 } : { w: 1, h: 1 }, existed: false }) };
    return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({ error: 'not-found' }) };
  };
  return s;
}
const editorStub = () => ({ mode: () => 'move', setMode() {}, space: () => 'world', setSpace() {}, snapOn: () => false, setSnap() {}, snapSteps: () => ({ move: 0.25, turn: 15, size: 0.1 }), eyeSpeed: () => 12, placeNew() {}, placeAsset() {} });

async function over() {
  const meshBytes = encodePoiMesh(quad());
  const sha = await sha256(meshBytes);
  const assets = new Map([[sha, meshBytes]]);
  const svc = store();
  const edit = createPoiEdit({ rand: counting() });
  const panel = createPoiEditorPanel({ doc: document, edit, editor: editorStub(), feed: { asset: async (h) => { if (!assets.has(h)) throw new Error('poi asset: 404'); return assets.get(h); } }, io: () => ({ fetch: svc.fetch, base: 'https://svc', secret: 'tok' }), me: { handle: 'Mac', builder: true, approver: false }, onExit() {} });
  document.body.append(panel.root);
  panel.setOn(true);
  const id = edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Shrine' });
  edit.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: sha, submeshes: 2, name: 'Altar' })); });
  edit.select({ id, part: 'altar' });
  await flush();
  return { panel, edit, svc, id, sha, root: panel.root };
}

test('POI-5 THE MATERIAL EDITOR: a picture taken from a file - read by its header, uploaded by its name, worn as one step; not a picture: refused in words, nothing uploaded; the glow\'s strength scales its colour; the picture\'s turn kept in radians (mutants: the header unread; the strength unread)', async () => {
  const P = await over();
  const took = await P.panel.takePicture(PNG, (sha) => P.edit.edit(P.id, 'material', (d) => { d.parts[0].materials[0].texture = sha; }));
  assert.equal(took, true);
  const put = P.svc.asks.at(-1);
  assert.equal(put.method, 'PUT');
  assert.equal(put.path, `/v1/poi/asset/${await sha256(PNG)}?kind=texture`);
  assert.equal(P.edit.docOf(P.id).parts[0].materials[0].texture, await sha256(PNG));
  const asked = P.svc.asks.length;
  assert.equal(await P.panel.takePicture(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), () => assert.fail('never used')), false);
  assert.equal(P.svc.asks.length, asked, 'nothing uploaded');
  assert.match(P.root.querySelectorAll('*').find((n) => n.className.includes('dfpoi-status')).textContent, /PNG/);
  // the glow: its strength field scales the colour's numbers
  await flush();
  const right = P.root.querySelectorAll('*').find((n) => n.className.includes('dfpoi-right'));
  const glowRow = right.querySelectorAll('*').find((n) => n.tagName === 'LABEL' && n.textContent === 'Glow').parentNode;
  const glowColour = glowRow.querySelectorAll('input').find((n) => n.type === 'color');
  glowColour.value = '#ff8000'; glowColour.dispatch('change', {});
  await flush();
  const glowRow2 = right.querySelectorAll('*').find((n) => n.tagName === 'LABEL' && n.textContent === 'Glow').parentNode;
  const strength = glowRow2.querySelectorAll('input').find((n) => n.type === 'number');
  strength.value = '4'; strength.dispatch('change', {});
  const e = P.edit.docOf(P.id).parts[0].materials[0].emissiveColor;
  near(e[0], 4); near(e[1], (128 / 255) * 4, 1e-6); near(e[2], 0);
  await flush();
  const turnRow = right.querySelectorAll('*').find((n) => n.tagName === 'LABEL' && n.textContent === 'Picture turn (degrees)').parentNode;
  const turn = turnRow.querySelectorAll('input').find((n) => n.type === 'number');
  turn.value = '90'; turn.dispatch('change', {});
  near(P.edit.docOf(P.id).parts[0].materials[0].uv.rotation, Math.PI / 2);
  // two of the store's acts at once: the save held until BOTH are done, not freed by the first to finish
  await flush();
  const saveBtn = () => P.root.querySelectorAll('button').find((n) => n.textContent === 'Save draft (Ctrl+S)');
  assert.equal(saveBtn().disabled, false, 'nothing in flight: it can be saved');
  let open1, open2;
  P.svc.hold = [new Promise((r) => { open1 = r; }), new Promise((r) => { open2 = r; })];
  const first = P.panel.takePicture(PNG, () => {}), second = P.panel.takePicture(PNG, () => {});
  await until(() => !P.svc.hold.length, 'both uploads asked');
  // each upload hashes off the main thread before it asks, so either may take the first hold: wait for whichever
  // open1 lets go, never `first` by name - awaiting the one still held emptied the loop (deploy run 258, shard 2/4)
  open1(); await Promise.race([first, second]); await flush();
  assert.equal(saveBtn().disabled, true, 'one upload still in flight: the save held');
  open2(); await Promise.all([first, second]); await flush();
  assert.equal(saveBtn().disabled, false, 'both done: it can be saved');
  P.panel.destroy();
});

test('POI-5 THE UV PANEL: its view a round trip, its zoom keeping the point under the pointer; a click on a face takes it, a drag from empty space a box, 2 the edges; Apply uploads the mesh made again and the part wears it as one step, the dialog gone (mutants: the zoom drifts; the part never wears the new mesh)', async () => {
  const v = uvView(640, 640);
  const [x, y] = v.toPx(0.3, 0.7);
  const [u, w] = v.toUv(x, y);
  near(u, 0.3, 1e-12); near(w, 0.7, 1e-12);
  v.zoomAt(100, 200, 3);
  const [u2, w2] = v.toUv(100, 200);
  const before = uvView(640, 640).toUv(100, 200);
  near(u2, before[0], 1e-9); near(w2, before[1], 1e-9);
  // the panel over a quad: the first material's face under a click
  const P = await over();
  await P.panel.openUv(P.id, 'altar', 0);
  const dlg = P.panel.uvDialog();
  assert.ok(dlg, 'the UV editor open');
  assert.ok(P.root.contains(dlg.root));
  const canvas = dlg.root.querySelectorAll('canvas')[0];
  const toClient = (uu, vv) => { const [px, py] = dlg.view.toPx(uu, vv); return { clientX: (px * 100) / 640, clientY: (py * 100) / 640 }; };
  const [a, b, c] = dlg.edit.faceUvs(dlg.edit.faces()[0]);
  const mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
  const ev = (extra) => ({ button: 0, pointerId: 1, preventDefault() {}, stopPropagation() {}, ...extra });
  canvas.dispatch('pointerdown', ev(toClient(...mid)));
  canvas.dispatch('pointerup', ev(toClient(...mid)));
  assert.deepEqual([...dlg.edit.selection()], [dlg.edit.faces()[0]]);
  // a box from empty space round the whole square
  dlg.edit.clear();
  canvas.dispatch('pointerdown', ev(toClient(-0.1, -0.1)));
  canvas.dispatch('pointermove', ev(toClient(1.1, 1.1)));
  canvas.dispatch('pointerup', ev(toClient(1.1, 1.1)));
  assert.equal(dlg.edit.selection().size, 1, 'the one face the first material has');
  dlg.root.dispatch('keydown', { code: 'Digit2', preventDefault() {}, stopPropagation() {} });
  assert.equal(dlg.edit.mode(), 'edge');
  // a change, applied: the mesh made again, uploaded, worn
  dlg.edit.setMode('face');
  dlg.edit.transform({ move: [0.25, 0] });
  const applyBtn = dlg.root.querySelectorAll('button').find((n) => n.textContent === 'Apply to the part');
  applyBtn.click();
  await until(() => P.panel.uvDialog() === null, 'the dialog closed on its upload');
  const put = P.svc.asks.at(-1);
  assert.match(put.path, /^\/v1\/poi\/asset\/[0-9a-f]{64}\?kind=mesh$/);
  const newSha = put.path.slice('/v1/poi/asset/'.length, '/v1/poi/asset/'.length + 64);
  assert.equal(P.edit.docOf(P.id).parts[0].mesh, newSha);
  assert.equal(P.edit.undoLabel(), 'uv');
  // the mesh sent is the quad with its first material's UVs moved a quarter along u
  const sent = decodePoiMesh(put.body);
  assert.ok(!('error' in sent));
  assert.equal(sent.mesh.submeshes.length, 2);
  const us = [...sent.mesh.uvs].filter((_, i) => i % 2 === 0);
  assert.ok(us.some((x2) => Math.abs(x2 - 1.25) < 1e-6), 'a corner moved past the square\'s edge');
});
