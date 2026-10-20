// AUDIT POI, lane D (2026-10-15; bible/06-Systems/POI-Editor-Arc.md POI-3b, POI-4b, POI-5, POI-6) - THE PANELS, THEIR
// ASYNC FLOWS AND THEIR WORDS. Mac: "Audit everything. Ensure perfection."
//   - the editor's panel (src/ui/poi/poiEditorPanel.js): a dock drawn again after a press (a pressed control keeps the focus
//     in a browser - here a press is focus() then click(), as Chromium and Electron press); each act bound to what it was
//     drawn for; the store's acts one at a time a POI, a send and a take-back marking saved only what the store holds, a
//     submission never saved beside itself; a POI opened from the store as what it is; the UV editor, the pack and the
//     import let go of when they are left;
//   - the library (src/ui/poi/poiLibraryPanel.js), the approver's queue and a POI's history (src/ui/poi/poiReviewPanel.js) and
//     the UV editor (src/ui/poi/poiUvPanel.js): an answer acting on the dialog that asked, and no other;
//   - the words (src/poi/poiText.js): counts in their plurals, glTF's names in words, lists as the language lists.
// Over the shared fake document (test/chargenDom.mjs), as test/poi/poi6_review.test.js drives it.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPoiEditorPanel, POI_PANEL_CSS } from '../../src/ui/poi/poiEditorPanel.js';
import { createPoiEdit, newPart } from '../../src/poi/poiEdit.js';
import { encodePoiMesh } from '../../src/poi/poiMesh.js';
import { DEFAULT_MATERIAL } from '../../src/poi/poiLaw.js';
import { writePack } from '../../src/poi/poiPack.js';
import { writeGlb } from '../../src/poi/gltfExport.js';
import { problemText, gltfErrorText, diffText } from '../../src/poi/poiText.js';
import { t, setLocale } from '../../src/systems/textManager.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
/** Wait until `cond` holds - an upload hashes off the main thread, so no count of turns is sure to outlast it. */
const until = async (cond, what) => { const end = Date.now() + 10000; while (!cond()) { if (Date.now() > end) assert.fail(`never: ${what}`); await new Promise((r) => setTimeout(r, 1)); } };
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
  submeshes: [{ start: 0, count: 3 }, { start: 3, count: 3 }],
});
const POI_ID = 'poi-00000000beef';
const place = (extra = {}) => ({ px: 200, py: 210, x: 100, z: 200, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1, ...extra });
const partOf = (sha, key = 'tower') => ({ key, name: key, mesh: sha, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true, materials: [{ ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }] });
const docOf = (sha, name, extra = {}) => ({ v: 1, id: POI_ID, name, place: place(), parts: [partOf(sha)], lights: [], marker: { show: false }, ...extra });

/** The store, faked: what was asked, and its answers - `hold` a promise each ask waits on, in turn; `refuse` a route's
 *  refusal (`{ [path]: error }`). */
function store() {
  const s = { asks: [], refuse: {}, hold: [], draftRev: 2, history: new Map(), queue: [], more: false, items: [], entries: new Map(), list: [] };
  const ok = (data) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => data });
  const no = (error, status = 409) => ({ ok: false, status, headers: { get: () => null }, json: async () => ({ error }) });
  s.fetch = async (url, init = {}) => {
    const path = url.replace('https://svc', '');
    const body = init.body === undefined ? undefined : typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    s.asks.push({ path, method: init.method ?? 'GET', body });
    if (s.hold.length) await s.hold.shift();
    const route = path.replace(/\?.*$/, '').replace(/[0-9a-f]{64}$/, '<sha>');
    if (s.refuse[route]) return no(s.refuse[route]);
    if (path === '/v1/poi/draft') return ok({ id: body.doc.id, rev: ++s.draftRev, state: 'draft' });
    if (path === '/v1/poi/submit') return ok({ id: body.id, rev: body.rev, state: 'submitted' });
    if (path === '/v1/poi/withdraw') return ok({ id: body.id, rev: body.rev, state: 'draft' });
    if (path === '/v1/poi/retire') return ok({ id: body.id, rev: 9, state: 'submitted' });
    if (path === '/v1/poi/list') return ok({ pois: s.list });
    if (path === '/v1/poi/queue') return ok({ queue: s.queue, more: s.more });
    if (path === '/v1/poi/review') return ok({ id: body.id, rev: body.rev, state: body.verdict === 'approve' ? 'approved' : 'rejected' });
    if (path === '/v1/poi/rollback') return ok({ id: body.id, rev: body.rev, live: true });
    if (path === '/v1/poi/shelf' && (init.method ?? 'GET') === 'GET') return ok({ items: s.items });
    const one = /^\/v1\/poi\/shelf\/(lib-[0-9a-f]{12})$/.exec(path);
    // an entry the shelf has not got is not-found, as the store answers (poi.js shelfEntry) - the pack's import asks first
    if (one) return s.entries.has(one[1]) ? ok({ id: one[1], item: s.entries.get(one[1]), by: 'Mapper' }) : no('not-found', 404);
    if (path === '/v1/poi/shelf') return ok({ id: body.item.id, at: 1 });
    if (path === '/v1/poi/unshelve') return ok({ id: body.id, gone: true });
    const h = /^\/v1\/poi\/doc\/(poi-[0-9a-f]{12})$/.exec(path);
    if (h) return s.history.has(h[1]) ? ok(s.history.get(h[1])) : no('not-found', 404);
    const a = /^\/v1\/poi\/asset\/([0-9a-f]{64})\?kind=(mesh|texture)$/.exec(path);
    if (a) return ok({ sha: a[1], kind: a[2], meta: a[2] === 'mesh' ? { submeshes: 2 } : { w: 1, h: 1 }, existed: false });
    return no('not-found', 404);
  };
  s.count = (path, method = null) => s.asks.filter((x) => (typeof path === 'string' ? x.path === path : path.test(x.path)) && (!method || x.method === method)).length;
  return s;
}
const editorStub = () => { const e = { calls: [] }; return Object.assign(e, { mode: () => 'move', setMode() {}, space: () => 'world', setSpace() {}, snapOn: () => false, setSnap() {}, snapSteps: () => ({ move: 0.25, turn: 15, size: 0.1 }), eyeSpeed: () => 12, placeNew() {}, placeAsset: (a, n) => e.calls.push(['placeAsset', a, n]) }); };

async function over({ approver = false, handle = 'Mac' } = {}) {
  const meshBytes = encodePoiMesh(quad());
  const sha = await sha256(meshBytes);
  const assets = new Map([[sha, meshBytes]]);
  const svc = store();
  const edit = createPoiEdit({ rand: counting() });
  const editor = editorStub();
  const P = { gate: null, nothing: false, refreshed: 0, files: [], went: [] };
  const feed = {
    asset: async (h) => { if (P.gate) await P.gate.p; if (P.nothing) return undefined; if (!assets.has(h)) throw new Error('poi asset: 404'); return assets.get(h); },
    refresh: () => { P.refreshed++; },
  };
  const panel = createPoiEditorPanel({
    doc: document, edit, editor, feed, io: () => ({ fetch: svc.fetch, base: 'https://svc', secret: 'tok' }), me: { handle, builder: true, approver }, onExit() {}, rand: counting(),
    goTo: (p) => P.went.push(p), download: (name, bytes, type) => P.files.push({ name, bytes, type }),
  });
  document.body.append(panel.root);
  panel.setOn(true);
  await flush();
  return Object.assign(P, { panel, edit, editor, svc, sha, assets, meshBytes, root: panel.root });
}
const rightOf = (P) => all(P.root).find((n) => n.className === 'dfpoi-dock dfpoi-right');
const statusOf = (P) => all(P.root).find((n) => n.className.includes('dfpoi-status')).textContent;
const held = (svc) => { let open; svc.hold.push(new Promise((r) => { open = r; })); return () => open(); };
/** A new POI with a part, its model known, selected. */
async function camp(P, sel = null) {
  const id = P.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Camp' });
  P.edit.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: P.sha, submeshes: 2, name: 'Hut' })); });
  P.edit.select(sel ?? { id, part: null });
  await until(() => all(rightOf(P)).some((n) => n.textContent === 'Nothing. It can be saved.'), 'its model known');
  return id;
}
/** Saved as a draft, by the store. */
async function saved(P, id) {
  press(button(rightOf(P), 'Save draft (Ctrl+S)'));
  await until(() => P.edit.entryOf(id).state === 'draft', 'saved');
  await flush();
}
document.activeElement = document.body;

// ── U1: A DOCK DRAWN AGAIN AFTER A PRESS ─────────────────────────────

test('AUDIT POI U1 A PRESSED CONTROL HOLDS NOTHING: "Close" over unsaved work asks again (and only the question closes it); "Remove this part" and "Remove this light" pressed twice take one; "Add a light" shows the light; Save held through its own save; a box ticked draws the acts again; a field typed in keeps its text (mutants: held while anything is focused; the remove read the selection; the question by what closing is now)', async () => {
  const P = await over();
  const id = await camp(P);
  await saved(P, id);
  P.edit.edit(id, 'rename', (d) => { d.name = 'Camp with an afternoon of work'; });
  await flush();
  const close = button(rightOf(P), 'Close');
  press(close); await flush();
  assert.ok(button(rightOf(P), 'Close without saving?'), 'the question drawn while its button still has the focus');
  press(close); await flush();
  assert.equal(P.edit.has(id), true, 'what read "Close" asks again - it never closes unsaved work');
  press(button(rightOf(P), 'Close without saving?'));
  assert.equal(P.edit.has(id), false);

  // the part removed once; the second press of a double one does not take the new POI with it
  const id2 = await camp(P);
  P.edit.select({ id: id2, part: 'hut' }); await flush();
  const rm = button(rightOf(P), 'Remove this part');
  press(rm); await flush();
  assert.equal(P.edit.docOf(id2).parts.length, 0);
  assert.equal(button(rightOf(P), 'Remove this part'), undefined, 'the inspector drawn again: the part gone from it');
  press(rm); await flush();
  assert.equal(P.edit.has(id2), true, 'the POI still open');
  assert.equal(P.edit.undoLabel(), 'remove part');
  P.edit.undo(); await flush();

  // a light added: its own fields shown
  P.edit.select({ id: id2, part: null }); await flush();
  const add = button(rightOf(P), 'Add a light');
  press(add); await flush();
  assert.deepEqual(P.edit.selection(), { id: id2, part: null, light: 0 });
  assert.equal(all(rightOf(P)).find((n) => n.className === 'dfpoi-h')?.textContent, 'Light 1', 'the inspector on the light');
  press(add); await flush();
  assert.equal(P.edit.docOf(id2).lights.length, 1, 'the add drawn before it pressed again: no second light');
  // three lights, the first removed by a double press: one goes
  P.edit.edit(id2, 'light', (x) => { x.lights.push({ t: [0, 3, 0], color: [1, 0, 0], radius: 5, intensity: 1, flicker: false }, { t: [0, 4, 0], color: [0, 1, 0], radius: 5, intensity: 1, flicker: false }); }, { id: id2, part: null, light: 0 });
  await flush();
  const rl = button(rightOf(P), 'Remove this light');
  press(rl); await flush(); press(rl); await flush();
  assert.equal(P.edit.docOf(id2).lights.length, 2, 'one light taken');

  // Save, held through its own save: one PUT
  P.edit.select({ id: id2, part: null }); await flush();
  const open = held(P.svc);
  const save = button(rightOf(P), 'Save draft (Ctrl+S)');
  assert.equal(save.disabled, false);
  press(save); await flush();
  assert.equal(button(rightOf(P), 'Save draft (Ctrl+S)').disabled, true, 'drawn held while it is out');
  press(save);
  open();
  await until(() => P.edit.entryOf(id2).state === 'draft', 'saved'); await flush();
  assert.equal(P.svc.count('/v1/poi/draft'), 2, 'the first draft\'s save and this one: no second PUT');
  assert.equal(button(rightOf(P), 'Save draft (Ctrl+S)').disabled, true, 'saved: nothing to save');

  // a box ticked: the acts drawn again (the save now pressable, the way back offered)
  P.edit.select({ id: id2, part: 'hut' }); await flush();
  const solid = all(rightOf(P)).find((n) => n.tagName === 'INPUT' && n.type === 'checkbox');
  solid.focus(); solid.checked = false; solid.dispatch('change', {});
  await flush();
  assert.equal(button(rightOf(P), 'Save draft (Ctrl+S)').disabled, false);
  assert.ok(button(rightOf(P), 'Put back as saved'));

  // a field being typed in keeps its text while the POI changes under it, and lets go once it is left
  const name = all(rightOf(P)).find((n) => n.tagName === 'INPUT' && n.type === 'text');
  name.focus(); name.value = 'Hut with a ro';
  P.edit.edit(id2, 'move', (d) => { d.place.x = 7; });
  await flush();
  assert.ok(rightOf(P).contains(name), 'the field typed in is the one there');
  assert.equal(name.value, 'Hut with a ro');
  document.activeElement = document.body; rightOf(P).dispatch('focusout', {});
  await flush();
  assert.ok(!rightOf(P).contains(name), 'let go: drawn again');
  P.panel.destroy();
});

// ── U2, U3, U5: THE STORE'S ACTS ──────────────────────────────────────

test('AUDIT POI U2 A SEND AND A TAKE-BACK MARK SAVED WHAT THE STORE HOLDS: changes made while it is sent, and changes taken back with a submission, stay changes to save - Close asks over them (mutants: the screen\'s document marked saved)', async () => {
  const P = await over();
  const id = await camp(P);
  await saved(P, id);
  const open = held(P.svc);
  press(button(rightOf(P), 'Send for approval'));
  await until(() => P.svc.count('/v1/poi/submit') === 1, 'sent');
  P.edit.edit(id, 'rename', (d) => { d.name = 'Camp, typed while it went'; });
  open();
  await until(() => P.edit.entryOf(id).state === 'submitted', 'submitted'); await flush();
  assert.equal(P.edit.dirty(id), true, 'the name typed while it went is not what the store holds');
  assert.equal(JSON.parse(P.edit.entryOf(id).saved).name, 'Camp');
  press(button(rightOf(P), 'Take back to draft'));
  await until(() => P.edit.entryOf(id).state === 'draft', 'taken back'); await flush();
  assert.equal(P.edit.dirty(id), true, 'taken back, the store\'s draft is the submission - the change still to save');
  press(button(rightOf(P), 'Close')); await flush();
  assert.equal(P.edit.has(id), true, 'Close asks first');
  P.panel.destroy();
});

test('AUDIT POI U3 A SUBMISSION IS NOT SAVED BESIDE ITSELF: changed while it waits, its Save is held and the way said - take it back first; Ctrl+S says the same and sends nothing (mutants: Save offered on a submission; the key saves it)', async () => {
  const P = await over();
  const id = await camp(P);
  await saved(P, id);
  press(button(rightOf(P), 'Send for approval'));
  await until(() => P.edit.entryOf(id).state === 'submitted', 'submitted'); await flush();
  P.edit.edit(id, 'rename', (d) => { d.name = 'Camp II'; }); await flush();
  assert.equal(button(rightOf(P), 'Save draft (Ctrl+S)').disabled, true);
  assert.ok(all(rightOf(P)).some((n) => n.textContent === 'It is waiting for approval: take it back to draft to save these changes.'));
  const drafts = P.svc.count('/v1/poi/draft');
  P.panel.acts.save(); await flush();
  assert.equal(P.svc.count('/v1/poi/draft'), drafts, 'no draft PUT beside the submission');
  assert.equal(statusOf(P), 'It is waiting for approval: take it back to draft to save these changes.');
  assert.ok(button(rightOf(P), 'Take back to draft'), 'the submission still the one held');
  P.panel.destroy();
});

test('AUDIT POI U5 CTRL+S AS THE BUTTON: never while its models are being checked, never for an unchanged draft, never twice at once (mutants: the key saves while checking; unchanged; a second while the first is out)', async () => {
  const P = await over();
  const gate = {}; gate.p = new Promise((r) => { gate.open = r; });
  P.gate = gate;
  const id = P.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Camp' });
  P.edit.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: P.sha, submeshes: 2, name: 'Hut' })); });
  P.edit.select({ id, part: null }); await flush();
  assert.ok(all(rightOf(P)).some((n) => n.textContent === 'Checking its models and pictures...'));
  P.panel.acts.save(); await flush();
  assert.equal(P.svc.count('/v1/poi/draft'), 0, 'not while its model is unknown');
  assert.match(statusOf(P), /still being checked/);
  P.gate = null; gate.open(); await flush();
  // held down: the repeats while the first is out send nothing more
  const open = held(P.svc);
  for (let i = 0; i < 5; i++) P.panel.acts.save();
  await until(() => P.svc.count('/v1/poi/draft') === 1, 'the first');
  open();
  await until(() => P.edit.entryOf(id).state === 'draft', 'saved'); await flush();
  for (let i = 0; i < 5; i++) P.panel.acts.save();
  await flush();
  assert.equal(P.svc.count('/v1/poi/draft'), 1, 'one PUT: none for the repeats, none for an unchanged draft');
  P.panel.destroy();
});

// ── U4, P6: OPENED FROM THE STORE AS WHAT IT IS ───────────────────────

test('AUDIT POI U4 P6 OPENED AS WHAT IT IS: my own sent-back revision says so and is sent again as a new draft (never `rev: null`); another builder\'s newest opens as a change to save as my own; my own draft keeps the base it was made from - the queue sees it stale (mutants: the sent-back opened as a clean draft; sent unsaved; the live base written over mine)', async () => {
  const P = await over({ handle: 'Mac' });
  P.svc.history.set(POI_ID, { id: POI_ID, liveRev: null, revs: [{ rev: 1, kind: 'doc', doc: docOf(P.sha, 'Tower'), base: null, author: 'Mac', state: 'rejected', reviewer: 'Ann', note: 'The door faces the cliff.' }] });
  await P.panel.open(POI_ID);
  await until(() => all(rightOf(P)).some((n) => n.textContent === 'Nothing. It can be saved.'), 'known');
  assert.deepEqual([P.edit.entryOf(POI_ID).state, P.edit.entryOf(POI_ID).rev, P.edit.dirty(POI_ID)], ['rejected', null, false]);
  assert.ok(all(P.root).some((n) => n.className === 'dfpoi-chip' && n.textContent === 'sent back'));
  press(button(rightOf(P), 'Send for approval'));
  await until(() => P.svc.count('/v1/poi/submit') === 1, 'sent');
  const put = P.svc.asks.find((a) => a.path === '/v1/poi/draft');
  assert.ok(put, 'saved first as a new draft');
  assert.deepEqual(P.svc.asks.find((a) => a.path === '/v1/poi/submit').body, { id: POI_ID, rev: 3 });
  await until(() => P.edit.entryOf(POI_ID).state === 'submitted', 'submitted');
  P.edit.close(POI_ID);
  // another builder's newest, nothing live: a change to save as my own draft
  P.svc.history.set(POI_ID, { id: POI_ID, liveRev: null, revs: [{ rev: 1, kind: 'doc', doc: docOf(P.sha, 'Tower'), base: null, author: 'Ann', state: 'draft' }] });
  await P.panel.open(POI_ID);
  await until(() => all(rightOf(P)).some((n) => n.textContent === 'Nothing. It can be saved.'), 'known');
  assert.equal(P.edit.dirty(POI_ID), true, 'not mine: a change to save');
  assert.equal(button(rightOf(P), 'Save draft (Ctrl+S)').disabled, false);
  P.edit.close(POI_ID);
  // my own draft, made from revision 1 - revision 3 (Ann's) went live since: it opens, and saves, made from 1
  P.svc.history.set(POI_ID, { id: POI_ID, liveRev: 3, revs: [
    { rev: 1, kind: 'doc', doc: docOf(P.sha, 'Tower'), base: null, author: 'Ann', state: 'approved' },
    { rev: 2, kind: 'doc', doc: docOf(P.sha, 'Tower (Mac)'), base: 1, author: 'Mac', state: 'draft' },
    { rev: 3, kind: 'doc', doc: docOf(P.sha, 'Tower (Ann)'), base: 1, author: 'Ann', state: 'approved' },
  ] });
  await P.panel.open(POI_ID);
  assert.equal(P.edit.entryOf(POI_ID).base, 1);
  P.edit.edit(POI_ID, 'rename', (d) => { d.name = 'Tower (Mac), again'; });
  await until(() => !button(rightOf(P), 'Save draft (Ctrl+S)')?.disabled, 'savable');
  press(button(rightOf(P), 'Save draft (Ctrl+S)'));
  await until(() => P.svc.count('/v1/poi/draft') === 2, 'saved');
  assert.equal(P.svc.asks.filter((a) => a.path === '/v1/poi/draft').at(-1).body.base, 1, 'the base it was made from');
  P.panel.destroy();
});

// ── U6, U7, U8: THE UV EDITOR ─────────────────────────────────────────

/** A shrine with an altar of two materials, its UV editor's door. */
async function shrine(P) {
  const id = P.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Shrine' });
  P.edit.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: P.sha, submeshes: 2, name: 'Altar' })); });
  await flush();
  return id;
}
const uvButton = (dlg, text) => dlg.root.querySelectorAll('button').find((n) => n.textContent === text);

test('AUDIT POI U6 A KEY TYPED INTO THE UV EDITOR\'S FIELDS IS THE FIELD\'S: digits, Ctrl+A and Escape typed into the density reach it, the modes and the selection untouched; on the dialog itself they are the editor\'s (mutant: the keys taken from the field)', async () => {
  const P = await over();
  const id = await shrine(P);
  await P.panel.openUv(id, 'altar', 0);
  const dlg = P.panel.uvDialog();
  const density = dlg.root.querySelectorAll('input').find((n) => n.type === 'number' && n.value === '256');
  const key = (target, code, extra = {}) => { const ev = { code, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...extra }; dlg.root.dispatch('keydown', ev); return ev; };
  for (const code of ['Digit2', 'Digit5', 'Digit6']) assert.equal(key(density, code).defaultPrevented, false, `${code} typed`);
  assert.equal(dlg.edit.mode(), 'face', 'the mode as it was');
  assert.equal(key(density, 'KeyA', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(dlg.edit.selection().size, 0);
  assert.equal(key(dlg.root, 'Digit2').defaultPrevented, true, 'on the dialog, the editor\'s');
  assert.equal(dlg.edit.mode(), 'edge');
  dlg.close();
  P.panel.destroy();
});

test('AUDIT POI U7 THE UV EDITOR LET GO OF: Cancel while Apply goes up lets it all go (the part keeps its model, nothing said applied); closed twice it lets go of its own handle only; two quick presses open one; Apply once the part is gone says so (mutants: the closed result worn; onClose twice; no pending; applied said for nothing)', async () => {
  const P = await over();
  const id = await shrine(P);
  await P.panel.openUv(id, 'altar', 0);
  const first = P.panel.uvDialog();
  first.edit.setMode('face'); first.edit.transform({ move: [0.25, 0] });
  const open = held(P.svc);
  press(uvButton(first, 'Apply to the part'));
  await until(() => P.svc.hold.length === 0, 'the upload asked');
  press(uvButton(first, 'Cancel'));
  assert.equal(P.panel.uvDialog(), null);
  await P.panel.openUv(id, 'altar', 1);
  const second = P.panel.uvDialog();
  assert.ok(second && second !== first);
  const mesh = P.edit.docOf(id).parts[0].mesh, said = statusOf(P);
  open();
  await until(() => P.svc.asks.length > 0 && !first.root.parentNode, 'answered'); await flush(); await flush();
  assert.equal(P.edit.docOf(id).parts[0].mesh, mesh, 'cancelled: the part keeps its model');
  assert.equal(statusOf(P), said, 'nothing said applied');
  assert.equal(P.panel.uvDialog(), second, 'the UV editor opened since is still the one held');
  first.close();
  assert.equal(P.panel.uvDialog(), second, 'the first closed again: the second still held');
  second.close(); second.close();
  assert.equal(P.panel.uvDialog(), null);
  // the part dressed anew while its model is fetched: nothing opened over it
  const gate0 = {}; gate0.p = new Promise((r) => { gate0.open = r; });
  P.gate = gate0;
  const opening = P.panel.openUv(id, 'altar', 0);
  P.edit.edit(id, 'size', (d) => { d.parts[0].mesh = 'f'.repeat(64); });
  P.gate = null; gate0.open(); await opening; await flush();
  assert.equal(P.panel.uvDialog(), null, 'its model changed while it came: not opened');
  P.edit.undo(); await flush();
  // two quick presses before the model comes: one dialog
  const gate = {}; gate.p = new Promise((r) => { gate.open = r; });
  P.gate = gate;
  const a = P.panel.openUv(id, 'altar', 0), b = P.panel.openUv(id, 'altar', 0);
  P.gate = null; gate.open(); await a; await b; await flush();
  assert.equal(all(P.root).filter((n) => n.className === 'dfpoi-uv').length, 1);
  // the part taken out under it: Apply says so, and nothing is worn
  const dlg = P.panel.uvDialog();
  dlg.edit.setMode('face'); dlg.edit.transform({ move: [0.5, 0] });
  P.edit.edit(id, 'remove part', (d) => { d.parts = []; });
  press(uvButton(dlg, 'Apply to the part'));
  await until(() => P.panel.uvDialog() === null, 'closed');
  assert.equal(statusOf(P), 'The part is gone: the UVs were not applied.');
  P.panel.destroy();
});

test('AUDIT POI U8 LEAVING THE EDITOR LETS GO OF WHAT WAS OPEN OVER IT: the UV editor taken away (and hidden by the off rule), the library closed, the approver\'s look ended - the world shown as it stands (mutants: setOn(false) closes nothing; the UV editor not under the off rule)', async () => {
  assert.match(POI_PANEL_CSS, /\.dfpoi\[data-on="0"\] \.dfpoi-uv[ ,{]/, 'the off rule hides the UV editor too');
  const P = await over({ approver: true });
  const live = docOf(P.sha, 'Old tower');
  const sent = { ...structuredClone(live), name: 'Old tower, mended' };
  P.svc.queue = [{ id: POI_ID, rev: 4, kind: 'doc', doc: sent, docSha: 'c'.repeat(64), base: 3, author: 'Ann', at: 1, submittedAt: Date.now() / 1000 - 60, liveRev: 3, liveDoc: live, stale: false }];
  press(button(P.root, 'Approvals'));
  await until(() => !!P.panel.review.queue(), 'listed'); await flush();
  press(button(P.panel.review.dialog(), 'Look at it'));
  press(button(P.panel.review.dialog(), 'Show the live one'));
  assert.equal(P.edit.shownAs(POI_ID).name, 'Old tower');
  await P.panel.openUv(POI_ID, 'tower', 0);
  const uv = P.panel.uvDialog().root;
  P.panel.setOn(false);
  assert.equal(P.panel.uvDialog(), null);
  assert.ok(!P.root.contains(uv), 'the UV editor gone with the editor');
  assert.equal(P.panel.review.dialog(), null);
  assert.equal(P.panel.review.looking(), null);
  assert.equal(P.edit.shownAs(POI_ID), undefined, 'the look let go: the world as it stands');
  P.panel.setOn(true);
  press(button(P.root, 'Library'));
  assert.ok(P.panel.library.dialog());
  P.panel.setOn(false);
  assert.equal(P.panel.library.dialog(), null);
  // left while the UV editor's model is fetched: it does not open over the game
  P.panel.setOn(true);
  const gate = {}; gate.p = new Promise((r) => { gate.open = r; });
  P.gate = gate;
  const opening = P.panel.openUv(POI_ID, 'tower', 0);
  P.panel.setOn(false);
  P.gate = null; gate.open(); await opening; await flush();
  assert.equal(P.panel.uvDialog(), null);
  assert.equal(all(P.root).filter((n) => n.className === 'dfpoi-uv').length, 0);
  P.panel.destroy();
});

// ── U9, U10, C4, C5: THE PACK, THE IMPORT ─────────────────────────────

async function packOf(P) {
  const doc = docOf(P.sha, 'Tower');
  const entry = { v: 1, id: 'lib-00000000cafe', name: 'Tower', parts: [partOf(P.sha)], lights: [], thumb: null };
  return { doc, bytes: writePack({ pois: [doc], shelf: [entry], assets: new Map([[P.sha, P.meshBytes]]) }).bytes };
}

test('AUDIT POI U9 A PACK GOES IN ONCE, AND CANCEL STOPS IT: pressed twice it uploads once; Cancel while it goes up uploads no more and opens nothing, the dialog opened since left open; the import of a model the same - nothing placed (mutants: pressed twice, twice; the cancelled pack opened; its answer closes the dialog opened since)', async () => {
  const P = await over();
  const { doc, bytes } = await packOf(P);
  assert.equal(await P.panel.openPack(bytes), true);
  const go = button(P.root, 'Upload and open');
  press(go); press(go);
  await until(() => P.edit.has(doc.id), 'opened'); await flush();
  assert.equal(P.svc.count(/^\/v1\/poi\/asset\//, 'PUT'), 1, 'its one asset uploaded once');
  assert.equal(P.svc.count('/v1/poi/shelf', 'PUT'), 1, 'its one entry put once');
  P.panel.destroy();

  const Q = await over();
  const pack = await packOf(Q);
  await Q.panel.openPack(pack.bytes);
  const open = held(Q.svc);
  press(button(Q.root, 'Upload and open'));
  await until(() => Q.svc.hold.length === 0, 'asked');
  press(button(Q.root, 'Cancel'));
  press(button(Q.root, 'Import model'));
  const importDlg = all(Q.root).find((n) => n.className === 'dfpoi-dialog' && n.textContent.includes('Import a model'));
  assert.ok(importDlg);
  open();
  await until(() => /^Stopped/.test(statusOf(Q)), 'said'); await flush();
  assert.equal(Q.edit.has(pack.doc.id), false, 'nothing opened');
  assert.equal(Q.svc.count('/v1/poi/shelf', 'PUT'), 0, 'nothing more put after the stop');
  assert.ok(Q.root.contains(importDlg), 'the dialog opened since left open');
  assert.equal(statusOf(Q), 'Stopped. Nothing was opened, but files uploaded before the stop stay in the store.');

  // the import: Cancel while its parts go up - nothing placed, the dialog opened since left open
  const glb = writeGlb({ name: 'Pair', parts: [{ key: 'left', name: 'left', mesh: quad(), t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], materials: [{ ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }] }], lights: [], pictures: new Map() });
  const input = all(importDlg).find((n) => n.tagName === 'INPUT' && n.type === 'file');
  input.files = [{ name: 'pair.glb', arrayBuffer: async () => glb.slice().buffer }];
  input.dispatch('change', {}); await flush();
  const open2 = held(Q.svc);
  press(button(importDlg, 'Upload and place'));
  await until(() => Q.svc.hold.length === 0, 'asked');
  press(button(importDlg, 'Cancel'));
  press(button(Q.root, 'Import model'));
  const again = all(Q.root).find((n) => n.className === 'dfpoi-dialog' && n.textContent.includes('Import a model'));
  open2();
  await until(() => statusOf(Q) === 'Stopped: nothing was placed.', 'said'); await flush();
  assert.equal(Q.editor.calls.length, 0, 'nothing placed');
  assert.ok(Q.root.contains(again));
  Q.panel.destroy();
});

test('AUDIT POI U10 THE IMPORT\'S PARTS AS PRESSED: "Make" changed while they go up re-arms nothing, and the parts placed and kept are the ones pressed - no error, the entry kept (mutants: the split re-arms the button; the keeping reads the new parts)', async () => {
  const P = await over();
  const errors = [];
  const caught = (e) => errors.push(String(e?.message ?? e));
  process.on('unhandledRejection', caught);
  const part = (key, tt) => ({ key, name: key, mesh: quad(), t: tt, r: [0, 0, 0, 1], s: [1, 1, 1], materials: [{ ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }] });
  const glb = writeGlb({ name: 'Pair', parts: [part('left', [0, 0, 0]), part('right', [3, 0, 0])], lights: [], pictures: new Map() });
  press(button(P.root, 'Import model'));
  const dlg = all(P.root).find((n) => n.className === 'dfpoi-dialog');
  const input = all(dlg).find((n) => n.tagName === 'INPUT' && n.type === 'file');
  input.files = [{ name: 'pair.glb', arrayBuffer: async () => glb.slice().buffer }];
  input.dispatch('change', {}); await flush();
  const split = all(dlg).find((n) => n.tagName === 'SELECT');
  split.value = 'nodes'; split.dispatch('change', {});
  const placeBtn = button(dlg, 'Upload and place');
  const open = held(P.svc);
  press(placeBtn);
  await until(() => P.svc.hold.length === 0, 'asked');
  assert.equal(split.disabled, true, '"Make" held while they go up');
  assert.equal(input.disabled, true, 'the files held too');
  split.value = 'whole'; split.dispatch('change', {});
  assert.equal(placeBtn.disabled, true, 'not pressable again while it goes up');
  open();
  await until(() => P.editor.calls.length > 0, 'placed');
  await until(() => P.svc.count('/v1/poi/shelf', 'PUT') === 1 || errors.length > 0, 'kept');
  process.off('unhandledRejection', caught);
  assert.deepEqual(errors, []);
  assert.equal(P.editor.calls[0][1].parts.length, 2, 'the parts as pressed - one for each object');
  assert.equal(P.svc.count('/v1/poi/shelf', 'PUT'), 1, 'kept in the library');
  P.panel.destroy();
});

test('AUDIT POI C4 C5 A PACK\'S REFUSALS IN THEIR OWN WORDS: an export the pack law refuses says its sentence, not "would not load"; an import the store refuses says its word and where, in the pack dialog (mutants: every export refusal a failed fetch; the import refusal left unsaid in the dialog)', async () => {
  const P = await over();
  const id = await shrine(P);
  await until(() => P.panel.root && all(P.root).length > 0, 'drawn');
  P.edit.select({ id, part: null });
  await until(() => all(rightOf(P)).some((n) => n.textContent === 'Nothing. It can be saved.'), 'known');
  P.nothing = true;   // the feed answers nothing: the pack names an asset it does not carry
  press(button(P.root, 'Export pack'));
  await until(() => statusOf(P) !== '' && !/^Opened/.test(statusOf(P)) && /pack/.test(statusOf(P)), 'said');
  assert.equal(statusOf(P), 'The pack names a model or picture it does not carry.');
  P.nothing = false;
  const { bytes } = await packOf(P);
  P.svc.refuse['/v1/poi/asset/<sha>'] = 'poi-quota';
  await P.panel.openPack(bytes);
  press(button(P.root, 'Upload and open'));
  const line = `A model or picture (${P.sha.slice(0, 10)}): You have uploaded all you can today. Try again tomorrow.`;
  await until(() => all(P.root).some((n) => n.className === 'dfpoi-problem' && n.textContent === line), 'said in the dialog');
  assert.equal(button(P.root, 'Upload and open').disabled, false, 'pressable again');
  P.panel.destroy();
});

// ── U11: THE LIBRARY ──────────────────────────────────────────────────

test('AUDIT POI U11 THE LIBRARY\'S ANSWERS FOR THE DIALOG THAT ASKED: Place answering after a keep dialog opened places nothing and closes nothing; a keep answering after another opened leaves that one open; a Change row keeps what was typed through the list drawn again (mutants: the stale Place placed; the stale keep closes the new one; the row drawn from the entry)', async () => {
  const P = await over({ handle: 'Mapper' });
  const part = partOf(P.sha, 'body');
  P.svc.items = [
    { id: 'lib-00000000beef', name: 'Lantern post', tags: ['light'], thumb: null, parts: 1, triangles: 2, by: 'Mapper', at: 1, updatedAt: 2 },
    { id: 'lib-00000000cafe', name: 'Old well', tags: ['stone'], thumb: null, parts: 1, triangles: 2, by: 'mapper', at: 1, updatedAt: 1 },
  ];
  P.svc.entries.set('lib-00000000beef', { v: 1, id: 'lib-00000000beef', name: 'Lantern post', parts: [part], lights: [], thumb: null });
  P.svc.entries.set('lib-00000000cafe', { v: 1, id: 'lib-00000000cafe', name: 'Old well', parts: [part], lights: [], thumb: null });
  const id = await shrine(P);
  P.edit.select({ id, part: null }); await flush();
  press(button(P.root, 'Library'));
  await until(() => !!P.panel.library.items(), 'listed'); await flush();
  const rowOf = (name) => all(P.panel.library.dialog()).find((n) => n.className === 'dfpoi-shelf-row' && n.textContent.includes(name));
  const btnIn = (row, text) => row.querySelectorAll('button').find((b) => b.textContent === text);
  const open = held(P.svc);
  press(btnIn(rowOf('Lantern post'), 'Place'));
  await until(() => P.svc.hold.length === 0, 'asked');
  press(button(P.root, 'Keep it in the library...'));
  const keepDlg = P.panel.library.dialog();
  all(keepDlg).find((n) => n.tagName === 'INPUT' && n.type === 'text').value = 'Shrine of the west road';
  open(); await flush(); await flush();
  assert.equal(P.panel.library.dialog(), keepDlg, 'the keep dialog left open');
  assert.equal(P.editor.calls.length, 0, 'nothing placed');
  // a keep answering after another keep dialog opened
  const open2 = held(P.svc);
  press(button(keepDlg, 'Keep it'));
  await until(() => P.svc.hold.length === 0, 'asked');
  press(button(P.root, 'Keep it in the library...'));
  const second = P.panel.library.dialog();
  assert.ok(second !== keepDlg);
  open2();
  await until(() => P.svc.count('/v1/poi/shelf', 'PUT') === 1, 'kept'); await flush();
  assert.equal(P.panel.library.dialog(), second, 'the dialog opened since left open');
  // a Change row keeps what was typed while the list is drawn again
  press(button(P.root, 'Library'));
  await until(() => all(P.panel.library.dialog()).some((n) => n.className === 'dfpoi-shelf-row'), 'listed'); await flush();
  press(btnIn(rowOf('Old well'), 'Change...'));
  await until(() => all(P.panel.library.dialog()).some((n) => n.tagName === 'TEXTAREA'), 'editing'); await flush();
  const nameIn = () => all(P.panel.library.dialog()).find((n) => n.tagName === 'INPUT' && n.type === 'text');
  nameIn().value = 'Old well, mossy'; nameIn().dispatch('input', {});
  press(btnIn(rowOf('Lantern post'), 'Take off the shelf'));
  assert.equal(nameIn().value, 'Old well, mossy');
  const find = all(P.panel.library.dialog()).find((n) => n.tagName === 'INPUT' && n.type === 'search');
  find.value = 'well'; find.dispatch('input', {});
  assert.equal(nameIn().value, 'Old well, mossy', 'through a search letter too');
  find.value = ''; find.dispatch('input', {});
  // its Save answering after another entry's Change began: that one stays open, its words with it
  const open3 = held(P.svc);
  press(button(P.panel.library.dialog(), 'Save'));
  await until(() => P.svc.hold.length === 0, 'asked');
  press(btnIn(rowOf('Lantern post'), 'Change...'));
  await until(() => nameIn()?.value === 'Lantern post', 'the lantern\'s row');
  nameIn().value = 'Lantern post, tall'; nameIn().dispatch('input', {});
  open3();
  await until(() => P.svc.count('/v1/poi/shelf', 'GET') >= 3, 'listed again'); await flush();
  assert.equal(nameIn()?.value, 'Lantern post, tall', 'the change begun since kept');
  // a Change answering after the library was opened anew: no row opened in the new one
  const open4 = held(P.svc);
  press(btnIn(rowOf('Old well'), 'Change...'));
  await until(() => P.svc.hold.length === 0, 'asked');
  press(button(P.root, 'Library'));
  open4(); await flush(); await flush();
  assert.equal(all(P.panel.library.dialog()).some((n) => n.tagName === 'TEXTAREA'), false);
  P.panel.destroy();
});

// ── U12, P8, C1, C2, C3, C7: THE QUEUE AND THE HISTORY ─────────────────

test('AUDIT POI U12 P8 C7 THE QUEUE AND THE HISTORY ANSWER WHERE THEY ASKED: a put-back answering after the queue opened leaves the queue and its look; after a revision was opened, opens nothing over the editor; Approve pressed twice sends one word; a look refused leaves the look before it as it was; the game\'s feed asked again after a verdict and a put-back (mutants: the history reopened; the decision sent twice; the look let go before the refusal; no refresh)', async () => {
  const P = await over({ approver: true });
  const first = docOf(P.sha, 'First'), second = docOf(P.sha, 'Second');
  P.svc.history.set(POI_ID, { id: POI_ID, liveRev: 2, revs: [
    { rev: 1, kind: 'doc', doc: first, author: 'Ann', at: 1, state: 'approved', reviewer: 'Mac' },
    { rev: 2, kind: 'doc', doc: second, author: 'Ann', at: 2, state: 'approved', reviewer: 'Mac' }] });
  const hut = 'poi-0000000f00d0';
  const hutDoc = { ...docOf(P.sha, 'Hut'), id: hut };
  P.svc.queue = [{ id: hut, rev: 4, kind: 'doc', doc: hutDoc, docSha: 'd'.repeat(64), base: null, author: 'Ann', at: 1, submittedAt: Date.now() / 1000 - 60, liveRev: null, liveDoc: null, stale: false }];
  P.edit.open(POI_ID, { doc: second, base: 2, rev: null, state: 'live' });
  P.edit.select({ id: POI_ID, part: null }); await flush();
  press(button(P.root, 'History...'));
  await until(() => all(P.panel.review.dialog()).some((n) => n.textContent === 'Revision 1: First'), 'history');
  press(button(P.panel.review.dialog(), 'Put this one back'));
  const open = held(P.svc);
  press(button(P.panel.review.dialog(), 'Put it back in the world?'));
  await until(() => P.svc.hold.length === 0, 'asked');
  assert.equal(button(P.panel.review.dialog(), 'Put this one back').disabled, true, 'held while the put-back is out');
  press(button(P.root, 'Approvals'));
  await until(() => !!P.panel.review.queue(), 'queue'); await flush();
  press(button(P.panel.review.dialog(), 'Look at it'));
  open();
  await until(() => P.refreshed === 1, 'the feed asked again'); await flush(); await flush();
  assert.equal(P.panel.review.dialog()?.dataset.kind, 'queue', 'the queue left open');
  assert.equal(P.panel.review.looking()?.id, hut, 'and its look');

  // Approve pressed twice: one word sent
  const ap = button(P.panel.review.dialog(), 'Approve');
  press(ap);
  assert.equal(button(P.panel.review.dialog(), 'Approve').disabled, true, 'drawn held while its word is out');
  press(ap);
  await until(() => P.refreshed === 2, 'approved, the feed asked again'); await flush();
  assert.equal(P.svc.count('/v1/poi/review'), 1);
  // C1 (the lead's, at lane A's merge): the approval names the document the approver looked at, to the store
  assert.equal(P.svc.asks.find((x) => x.path === '/v1/poi/review').body.docSha, 'd'.repeat(64));
  assert.equal(statusOf(P), 'Approved: Hut. It stands in the world.');

  // a revision opened while the put-back's history is asked again: nothing opened over the editor
  P.edit.select({ id: POI_ID, part: null }); await flush();
  press(button(P.root, 'History...'));
  await until(() => all(P.panel.review.dialog() ?? { querySelectorAll: () => [] }).some((n) => n.textContent === 'Revision 1: First'), 'history');
  press(button(P.panel.review.dialog(), 'Put this one back'));
  const openR = held(P.svc), open3 = held(P.svc);   // the put-back, then the history asked again after it
  press(button(P.panel.review.dialog(), 'Put it back in the world?'));
  await until(() => P.svc.count('/v1/poi/rollback') === 2, 'asked');
  openR();
  await until(() => P.refreshed === 3, 'put back');
  await until(() => P.svc.hold.length === 0, 'the history asked');
  press(all(P.panel.review.dialog()).filter((n) => n.tagName === 'BUTTON' && n.textContent === 'Open this one')[1]);
  assert.equal(P.panel.review.dialog(), null);
  open3(); await flush(); await flush();
  assert.equal(P.panel.review.dialog(), null, 'no history opened over the editor');
  P.panel.destroy();
});

test('AUDIT POI U12 T8 A LOOK REFUSED LEAVES THE LOOK BEFORE IT; LOOK AT IT AND OPEN THIS ONE NEVER OVERWRITE UNSAVED WORK (mutants: the showing let go before the refusal; the look overwrites; Open this one overwrites)', async () => {
  const P = await over({ approver: true });
  const live = docOf(P.sha, 'Old tower');
  const other = 'poi-0000000f00d0';
  const otherDoc = { ...docOf(P.sha, 'Hut'), id: other };
  P.svc.queue = [
    { id: POI_ID, rev: 4, kind: 'doc', doc: { ...structuredClone(live), name: 'Old tower, mended' }, base: 3, author: 'Ann', at: 1, submittedAt: Date.now() / 1000 - 60, liveRev: 3, liveDoc: live, stale: false },
    { id: other, rev: 2, kind: 'doc', doc: otherDoc, base: null, author: 'Ann', at: 1, submittedAt: Date.now() / 1000 - 30, liveRev: null, liveDoc: null, stale: false },
  ];
  P.edit.open(other, { doc: otherDoc, saved: null, base: null, rev: null, state: 'draft' });
  P.edit.edit(other, 'rename', (d) => { d.name = 'Hut, mine'; });
  press(button(P.root, 'Approvals'));
  await until(() => !!P.panel.review.queue(), 'listed'); await flush();
  const looks = () => all(P.panel.review.dialog()).filter((n) => n.tagName === 'BUTTON' && n.textContent === 'Look at it');
  press(looks()[0]);
  press(button(P.panel.review.dialog(), 'Show the live one'));
  press(looks()[1]);
  assert.equal(statusOf(P), 'You have this POI open with changes: save or close it first.');
  assert.equal(P.edit.docOf(other).name, 'Hut, mine', 'the unsaved work kept');
  assert.equal(P.panel.review.looking().id, POI_ID);
  assert.equal(P.edit.shownAs(POI_ID)?.name, 'Old tower', 'the live one still shown, as the chip says');
  assert.ok(all(P.panel.review.dialog()).some((n) => n.textContent === 'showing: the live one'));
  // Open this one, over unsaved work: refused
  P.svc.history.set(other, { id: other, liveRev: null, revs: [{ rev: 1, kind: 'doc', doc: otherDoc, author: 'Ann', at: 1, state: 'draft' }] });
  P.panel.review.openHistory(other);
  await until(() => !!button(P.panel.review.dialog() ?? { querySelectorAll: () => [] }, 'Open this one'), 'history');
  press(button(P.panel.review.dialog(), 'Open this one'));
  assert.equal(P.edit.docOf(other).name, 'Hut, mine');
  assert.equal(statusOf(P), 'You have this POI open with changes: save or close it first.');
  P.panel.destroy();
});

test('AUDIT POI C1 C3 T8 THE QUEUE: a submission changed since it was listed is said and the queue asked again, the look ended; the document\'s hash sent with the word; more waiting than listed is said; the stale warning on a stale one alone; before a new POI and after a retirement nothing stands (mutants: no refresh on poi-changed; the hash not sent; the bound unsaid; the warning on every one; something shown for nothing)', async () => {
  assert.match(src('src/ui/poi/poiReviewPanel.js'), /poiReview\(i, item\.id, item\.rev, verdict, word \|\| null, item\.docSha \?\? null\)/, 'the hash the queue gave, sent with the word (contract C1)');
  const P = await over({ approver: true });
  const live = docOf(P.sha, 'Old tower');
  const fresh = 'poi-0000000f00d0';
  P.svc.queue = [
    { id: POI_ID, rev: 4, kind: 'retire', doc: null, docSha: null, base: null, author: 'Ann', at: 1, submittedAt: Date.now() / 1000 - 60, liveRev: 3, liveDoc: live, stale: true },
    { id: fresh, rev: 2, kind: 'doc', doc: { ...docOf(P.sha, 'Hut'), id: fresh }, docSha: 'e'.repeat(64), base: null, author: 'Ann', at: 1, submittedAt: Date.now() / 1000 - 30, liveRev: null, liveDoc: null, stale: false },
  ];
  P.svc.more = true;
  press(button(P.root, 'Approvals'));
  await until(() => !!P.panel.review.queue(), 'listed'); await flush();
  const dlg = () => P.panel.review.dialog();
  assert.ok(all(dlg()).some((n) => n.textContent === 'More submissions are waiting. Decide on these to see the rest.'));
  assert.equal(all(dlg()).filter((n) => n.className === 'dfpoi-warn' && /older live revision/.test(n.textContent)).length, 1, 'the stale one alone warned');
  // a retirement: nothing after; its before the live one
  const looks = () => all(dlg()).filter((n) => n.tagName === 'BUTTON' && n.textContent === 'Look at it');
  press(looks()[0]);
  assert.equal(P.edit.shownAs(POI_ID), null, 'after a retirement, nothing stands');
  press(button(dlg(), 'Show the live one'));
  assert.equal(P.edit.shownAs(POI_ID)?.name, 'Old tower');
  // a new POI: the submission after; nothing before it
  press(looks()[1]);
  assert.equal(P.edit.overlay().get(fresh)?.doc.name, 'Hut');
  press(button(dlg(), 'Show the live one'));
  assert.equal(P.edit.shownAs(fresh), null, 'before a new POI, nothing stands');
  press(button(dlg(), 'Show the submission'));
  // changed since it was listed: said, the queue asked again, the look ended
  P.svc.refuse['/v1/poi/review'] = 'poi-changed';
  const asked = P.svc.count('/v1/poi/queue');
  press(all(dlg()).filter((n) => n.tagName === 'BUTTON' && n.textContent === 'Approve')[1]);
  await until(() => P.svc.count('/v1/poi/queue') === asked + 1, 'asked again'); await flush();
  assert.equal(P.panel.review.looking(), null, 'the look ended');
  assert.equal(P.edit.has(fresh), false, 'the submission looked at let go');
  P.panel.destroy();
});

test('AUDIT POI C2 T8 A POI\'S HISTORY: a put-back drawn as one, a taken-back retirement in words; nothing offered to put back that has no document; put back the approver\'s alone; History only once the store has the POI (mutants: a put-back offered on a retirement or a put-back; offered to a builder; History on a new POI)', async () => {
  const P = await over({ approver: true });
  const first = docOf(P.sha, 'First');
  const second = docOf(P.sha, 'Second');
  P.svc.history.set(POI_ID, { id: POI_ID, liveRev: 1, revs: [
    { rev: 1, kind: 'doc', doc: first, author: 'Ann', at: 1, state: 'approved', reviewer: 'Mac' },
    { rev: 2, kind: 'retire', doc: null, author: 'Ann', at: 2, state: 'approved', reviewer: 'Mac' },
    { rev: 3, kind: 'rollback', doc: null, base: 1, author: 'Mac', at: 3, state: 'approved' },
    { rev: 4, kind: 'retire', doc: null, author: 'Ann', at: 4, state: 'withdrawn' },
    { rev: 5, kind: 'doc', doc: second, author: 'Ann', at: 5, state: 'approved', reviewer: 'Mac' },
  ] });
  P.panel.review.openHistory(POI_ID);
  await until(() => all(P.panel.review.dialog()).some((n) => n.textContent === 'Revision 1: First'), 'history');
  const dlg = P.panel.review.dialog();
  assert.ok(all(dlg).some((n) => n.textContent === 'Revision 3: put revision 1 back in the world'));
  assert.ok(all(dlg).some((n) => /^taken back by its builder · by Ann/.test(n.textContent)));
  const rows = all(dlg).filter((n) => n.className === 'dfpoi-review');
  const offered = rows.filter((r) => r.querySelectorAll('button').some((b) => b.textContent === 'Put this one back')).map((r) => r.querySelectorAll('*').find((n) => n.className === 'dfpoi-shelf-name').textContent);
  assert.deepEqual(offered, ['Revision 5: Second'], 'a document alone goes back');
  P.panel.destroy();
  // a builder: no put-back; a new POI: no History until the store has it
  const B = await over({ approver: false });
  B.svc.history.set(POI_ID, P.svc.history.get(POI_ID));
  B.panel.review.openHistory(POI_ID);
  await until(() => all(B.panel.review.dialog()).some((n) => n.textContent === 'Revision 1: First'), 'history');
  assert.equal(button(B.panel.review.dialog(), 'Put this one back'), undefined, 'the approver\'s alone');
  B.panel.review.close();
  const id = await camp(B);
  assert.equal(button(rightOf(B), 'History...'), undefined, 'new: the store has no history of it');
  await saved(B, id);
  assert.ok(button(rightOf(B), 'History...'), 'saved: the store has it');
  B.panel.destroy();
});

test('AUDIT POI T8 THE LAW\'S REPORT IN THE QUEUE: never drawn again while a word is typed (the word and its field kept), drawn again once only a button holds the focus (mutants: drawn over the word; held for a pressed button)', async () => {
  const P = await over({ approver: true });
  const gate = {}; gate.p = new Promise((r) => { gate.open = r; });
  P.gate = gate;
  const hut = 'poi-0000000f00d0';
  P.svc.queue = [{ id: hut, rev: 2, kind: 'doc', doc: { ...docOf(P.sha, 'Hut'), id: hut }, base: null, author: 'Ann', at: 1, submittedAt: Date.now() / 1000 - 30, liveRev: null, liveDoc: null, stale: false }];
  press(button(P.root, 'Approvals'));
  await until(() => !!P.panel.review.queue(), 'listed'); await flush();
  const dlg = P.panel.review.dialog();
  assert.ok(all(dlg).some((n) => n.textContent === 'Checking its models and pictures...'));
  const note = all(dlg).find((n) => n.tagName === 'TEXTAREA');
  note.focus(); note.value = 'The door fa'; note.dispatch('input', {});
  P.gate = null; gate.open(); await flush(); await flush();
  assert.ok(dlg.contains(note), 'the field typed in is the one there');
  assert.ok(all(dlg).some((n) => n.textContent === 'Checking its models and pictures...'), 'not drawn while the word is typed');
  press(button(dlg, 'Refresh the list'));
  document.activeElement = button(dlg, 'Refresh the list') ?? document.body;
  P.panel.review.learned();
  assert.ok(all(dlg).some((n) => n.textContent === 'Nothing wrong.'), 'drawn again: a pressed button holds nothing');
  assert.equal(all(dlg).find((n) => n.tagName === 'TEXTAREA').value, 'The door fa', 'the word kept');
  P.panel.destroy();
});

// ── U13: THE WORDS ────────────────────────────────────────────────────

test('AUDIT POI U13 THE WORDS: counts in their plurals; glTF\'s object names said in words; the eye\'s speed a number; no tags left and a mark with no label said in words of their own; a part\'s changes listed as the language lists (mutants: "1 materials"; "a accessor"; "Its tags are now: ."; \'shown, ""\')', async () => {
  const importPart = (a) => t('poi.editor.importPart', '{name}: {vertices, plural, one {{vertices, number} vertex} other {{vertices, number} vertices}}, {triangles, plural, one {{triangles, number} triangle} other {{triangles, number} triangles}}, {materials, plural, one {# material} other {# materials}}', a);
  assert.equal(importPart({ name: 'Roof', vertices: 3, triangles: 1, materials: 1 }), 'Roof: 3 vertices, 1 triangle, 1 material');
  assert.equal(importPart({ name: 'Keep', vertices: 262144, triangles: 2, materials: 4 }), 'Keep: 262,144 vertices, 2 triangles, 4 materials');
  assert.match(src('src/ui/poi/poiEditorPanel.js'), /t\('poi\.editor\.importPart', '\{name\}: \{vertices, plural, one \{\{vertices, number\} vertex\}/);
  assert.match(src('src/ui/poi/poiEditorPanel.js'), /t\('poi\.editor\.speed', 'Eye \{speed, number\} m\/s'/);
  assert.equal(problemText({ code: 'material-count', want: 1, have: 2 }), 'Its model has 1 material; the part has 2.');
  assert.equal(gltfErrorText('missing', { what: 'accessor', index: 3 }), 'This model refers to an accessor that is not there.');
  assert.equal(gltfErrorText('missing', { what: 'bufferView', index: 0 }), 'This model refers to a buffer view that is not there.');
  assert.equal(gltfErrorText('past-end', { what: 'accessor' }), 'This model\'s data is cut short: an accessor runs past its end.');
  // PIN MOVED (AUDIT POI, the lead's join): poiDiff hands the tags themselves (`tags`), never an English-joined `to`
  assert.equal(diffText({ code: 'tags', tags: [] }), 'Its tags were all taken off.');
  assert.equal(diffText({ code: 'tags', tags: ['stone', 'old'] }), 'Its tags are now: stone, old.');
  assert.equal(diffText({ code: 'tags', tags: ['stone', 'old', 'small'] }), 'Its tags are now: stone, old, small.');
  assert.equal(diffText({ code: 'marker', show: true, label: '' }), 'Its mark on the map: shown, with no label.');
  assert.equal(diffText({ code: 'marker', show: true, label: 'Tower' }), 'Its mark on the map: shown, "Tower".');
  assert.equal(diffText({ code: 'marker', show: false }), 'Its mark on the map: hidden.');
  assert.equal(diffText({ code: 'part-changed', name: 'door', what: ['moved', 'materials', 'name'] }), 'Part door: moved, its materials, its name.');
  // listed the language's way, not with an English comma (the words here English: no Japanese table is loaded)
  const ja = (words) => new Intl.ListFormat('ja', { type: 'unit', style: 'short' }).format(words);
  setLocale('ja');
  try {
    assert.notEqual(ja(['a', 'b']), 'a, b', 'the runtime lists Japanese its own way');
    assert.equal(diffText({ code: 'part-changed', name: 'door', what: ['moved', 'materials'] }), `Part door: ${ja(['moved', 'its materials'])}.`);
    assert.equal(diffText({ code: 'tags', tags: ['stone', 'old'] }), `Its tags are now: ${ja(['stone', 'old'])}.`);
  } finally { setLocale('en'); }
  // the panel's own import line in its words
  const P = await over();
  const glb = writeGlb({ name: 'One', parts: [{ key: 'only', name: 'only', mesh: quad(), t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], materials: [{ ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }] }], lights: [], pictures: new Map() });
  press(button(P.root, 'Import model'));
  const dlg = all(P.root).find((n) => n.className === 'dfpoi-dialog');
  const input = all(dlg).find((n) => n.tagName === 'INPUT' && n.type === 'file');
  input.files = [{ name: 'one.glb', arrayBuffer: async () => glb.slice().buffer }];
  input.dispatch('change', {}); await flush();
  assert.ok(all(dlg).some((n) => /^One: \d+ vertices, 2 triangles, 2 materials$/.test(n.textContent)), all(dlg).map((n) => n.textContent).join(' | '));
  // one triangle of one material: each said in its singular
  const tri = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]), normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1]), uvs: new Float32Array([0, 1, 1, 1, 1, 0]), indices: new Uint16Array([0, 2, 1]), submeshes: [{ start: 0, count: 3 }] };
  const glb1 = writeGlb({ name: 'Tri', parts: [{ key: 'tri', name: 'tri', mesh: tri, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], materials: [{ ...DEFAULT_MATERIAL }] }], lights: [], pictures: new Map() });
  input.files = [{ name: 'tri.glb', arrayBuffer: async () => glb1.slice().buffer }];
  input.dispatch('change', {}); await flush();
  assert.ok(all(dlg).some((n) => n.textContent === 'Tri: 3 vertices, 1 triangle, 1 material'), all(dlg).map((n) => n.textContent).join(' | '));
  assert.ok(all(P.root).some((n) => n.textContent === 'Eye 12 m/s'));
  P.panel.destroy();
});
