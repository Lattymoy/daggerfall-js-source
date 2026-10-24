// POI-3b (2026-10-14; bible/06-Systems/POI-Editor-Arc.md) - THE EDITOR'S PANEL, ITS IMPORT, AND ITS PLACE IN THE WORLD.
// Mac: "a tool my developers can use without having to access the codebase ... I need to be able to approve changes".
//   - the panel (src/ui/poi/poiEditorPanel.js), headless over the shared fake document: the bar follows the editor's tools
//     and the undo; the outliner its POIs and their states; the inspector's fields each one step; what is wrong said in
//     words, the asset check waiting for the assets; the store's acts - save, send, take back, refusals as sentences;
//     opening from the store's list (my draft before the live revision); a close that asks again over unsaved work;
//   - the import (src/poi/poiImport.js): a model's parts held to the mesh law, its pictures by their headers, each
//     uploaded once by name, the materials' images their pictures' names;
//   - the world (src/scenes/world.js): `?editor` alone and refused online, the motor held and the eye the frame's while
//     it is open, the drafts laid over the feed before the POI host reads it, the lines after the translucent pass, no
//     hand drawn, no blow on the body left standing.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';
import { createPoiEditorPanel, stateText, stepText, createAssetFacts } from '../../src/ui/poi/poiEditorPanel.js';
import { createPoiEdit, newPart } from '../../src/poi/poiEdit.js';
import { prepareImport, uploadImport } from '../../src/poi/poiImport.js';
import { encodePoiMesh, POI_MESH_LIMITS } from '../../src/poi/poiMesh.js';
import { DEFAULT_MATERIAL } from '../../src/poi/poiLaw.js';
import { ONLINE_REFUSED_FLAGS } from '../../src/systems/online/onlineLane.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));
const quad = (subs = 2) => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
  uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
  indices: new Uint16Array(subs === 2 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]),
  submeshes: subs === 2 ? [{ start: 0, count: 3 }, { start: 3, count: 3 }] : [{ start: 0, count: 3 }],
});
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const counting = () => { let n = 0; return (b) => { for (let i = 0; i < b.length; i++) b[i] = (n + i) & 255; n++; return b; }; };
/** Every node under `root` whose own text is `text` (a button's label). */
const find = (root, text) => root.querySelectorAll('*').filter((n) => n.textContent === text);
const button = (root, text) => { const b = find(root, text).find((n) => n.tagName === 'BUTTON'); assert.ok(b, `a button "${text}"`); return b; };

/** The store, faked: what was asked, and its answers. */
function fakeStore() {
  const s = { asks: [], draftRev: 2, refuse: null, history: null, list: [] };
  s.fetch = async (url, init = {}) => {
    const path = url.replace('https://svc', '');
    const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    s.asks.push({ path, method: init.method ?? 'GET', body });
    const ok = (data) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => data });
    if (s.refuse) return { ok: false, status: 403, headers: { get: () => null }, json: async () => ({ error: s.refuse }) };
    if (path === '/v1/poi/draft') return ok({ id: body.doc.id, rev: ++s.draftRev, state: 'draft' });
    if (path === '/v1/poi/submit') return ok({ id: body.id, rev: body.rev, state: 'submitted' });
    if (path === '/v1/poi/withdraw') return ok({ id: body.id, rev: body.rev, state: 'draft' });
    if (path === '/v1/poi/list') return ok({ pois: s.list });
    if (path.startsWith('/v1/poi/doc/')) return ok(s.history);
    return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({ error: 'not-found' }) };
  };
  return s;
}
/** The editor host, faked: its tools and its calls. */
function fakeEditor() {
  const e = { m: 'move', sp: 'world', snap: false, calls: [] };
  return Object.assign(e, {
    mode: () => e.m, setMode: (m) => { e.m = m; e.calls.push(['mode', m]); }, space: () => e.sp, setSpace: (v) => { e.sp = v; },
    snapOn: () => e.snap, setSnap: (v) => { e.snap = v; }, snapSteps: () => ({ move: 0.25, turn: 15, size: 0.1 }), eyeSpeed: () => 12,
    placeNew: (n) => e.calls.push(['placeNew', n]), placeAsset: (a, n) => e.calls.push(['placeAsset', a, n]),
  });
}

async function panelOver({ assets = new Map(), handle = 'Mac', gate = null } = {}) {
  const store = fakeStore();
  const edit = createPoiEdit({ rand: counting() });
  const editor = fakeEditor();
  const feed = { asset: async (sha) => { if (gate) await gate; if (!assets.has(sha)) throw new Error(`poi asset ${sha.slice(0, 12)}: 404`); return assets.get(sha); } };
  const exits = [];
  const panel = createPoiEditorPanel({ doc: document, edit, editor, feed, io: () => ({ fetch: store.fetch, base: 'https://svc', secret: 'tok' }), me: { handle, builder: true, approver: false }, onExit: (how) => exits.push(how) });
  document.body.append(panel.root);
  panel.setOn(true);
  await flush();
  return { panel, edit, editor, store, exits, root: panel.root };
}

test('POI-3b THE BAR: the tools pressed as the editor holds them, a press the editor\'s; undo and redo off with nothing to do, and saying what they would undo; a new POI asked of the editor in the builder\'s words; the two ways out (mutants: the undo always on; the tool unpressed)', async () => {
  const P = await panelOver();
  assert.equal(button(P.root, 'Move (W)').getAttribute('aria-pressed'), 'true');
  assert.equal(button(P.root, 'Turn (E)').getAttribute('aria-pressed'), 'false');
  button(P.root, 'Turn (E)').click();
  assert.deepEqual(P.editor.calls.at(-1), ['mode', 'turn']);
  assert.equal(button(P.root, 'Undo').disabled, true);
  const id = P.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'A' });
  P.edit.edit(id, 'move', (d) => { d.place.x = 9; });
  await flush();
  const undo = button(P.root, 'Undo');
  assert.equal(undo.disabled, false);
  assert.equal(undo.title, 'Undo move (Ctrl+Z)');
  undo.click();
  assert.equal(P.edit.docOf(id).place.x, 5);
  await flush();
  assert.equal(button(P.root, 'Redo').title, 'Redo move (Ctrl+Y)');
  button(P.root, 'New POI').click();
  assert.deepEqual(P.editor.calls.at(-1), ['placeNew', 'New place']);
  button(P.root, 'Exit here').click(); button(P.root, 'Exit to where I stood').click();
  assert.deepEqual(P.exits, ['here', 'back']);
  assert.equal(stepText('add parts'), 'add part'); assert.equal(stepText('anything'), 'edit');
});

test('POI-3b THE OUTLINER AND THE INSPECTOR: each POI with its state (new, a draft, sent, live, changed) and its parts to select; a POI\'s name, its stand, its turn as three angles and its size, each field one step; a part\'s fields; what is wrong said in words, the save held until it is right (mutants: a field changed with no step; the problems unsaid)', async () => {
  const P = await panelOver();
  const id = P.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Camp' });
  await flush();
  assert.ok(find(P.root, 'Camp').length >= 1);
  assert.equal(stateText({ state: 'new' }, true), 'new');
  assert.equal(stateText({ state: 'draft' }, true), 'draft, changed');
  assert.equal(stateText({ state: 'submitted' }, false), 'sent for approval');
  // what is wrong: a new POI has no part
  assert.ok(find(P.root, 'Add at least one part.').length === 1, 'the law said in words');
  assert.equal(button(P.root, 'Save draft (Ctrl+S)').disabled, true);
  // the name: one step
  const name = byClass(P.root, 'dfpoi-right')[0].querySelectorAll('input').find((n) => n.value === 'Camp');
  name.value = 'Old Camp'; name.dispatch('change', {});
  assert.equal(P.edit.docOf(id).name, 'Old Camp');
  assert.equal(P.edit.undoLabel(), 'rename');
  await flush();
  // the stand and the turn
  const stands = byClass(P.root, 'dfpoi-right')[0].querySelectorAll('select')[0];
  stands.value = 'absolute'; stands.dispatch('change', {});
  assert.equal(P.edit.docOf(id).place.ground, 'absolute');
  await flush();
  const right = () => byClass(P.root, 'dfpoi-right')[0];
  const numbers = () => right().querySelectorAll('input').filter((n) => n.type === 'number');
  // the turn row's three angles follow the height field: spot x, spot z, height, then yaw x / y / z
  const yaw = numbers()[4];
  yaw.value = '90'; yaw.dispatch('change', {});
  const r = P.edit.docOf(id).place.r;
  assert.ok(Math.abs(r[1] - Math.SQRT1_2) < 1e-6 && Math.abs(r[3] - Math.SQRT1_2) < 1e-6, `a yaw of 90 (${r})`);
  // a part: its fields, selected from the outliner
  P.edit.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: 'a'.repeat(64), submeshes: 1, name: 'Hut' })); });
  await flush();
  find(P.root, 'Hut').find((n) => n.className.includes('dfpoi-item')).click();
  assert.deepEqual(P.edit.selection(), { id, part: 'hut', light: null });
  await flush();
  const solid = right().querySelectorAll('input').find((n) => n.type === 'checkbox');
  solid.checked = false; solid.dispatch('change', {});
  assert.equal(P.edit.docOf(id).parts[0].collide, 'none');
  P.panel.destroy();
});

test('POI-3b THE STORE\'S ACTS: the asset check waits for the assets, then the save goes - the draft PUT, its revision kept, the state a draft; sent for approval; taken back; a refusal said as the store\'s sentence; a close over unsaved work asks again (mutants: saved with its assets unknown; the revision not kept)', async () => {
  const meshBytes = encodePoiMesh(quad(1));
  const sha = await sha256(meshBytes);
  let release;
  const gate = new Promise((r) => { release = r; });
  const P = await panelOver({ assets: new Map([[sha, meshBytes]]), gate });
  const id = P.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Camp' });
  P.edit.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: sha, submeshes: 1, name: 'Hut' })); });
  P.edit.select({ id, part: null });
  await flush();
  // the mesh is fetched and read; until then nothing is said about it and the save waits
  assert.ok(find(P.root, 'Checking its models and pictures...').length === 1);
  assert.equal(button(P.root, 'Save draft (Ctrl+S)').disabled, true, 'held while its assets are unknown');
  release();
  await flush();
  const save = button(P.root, 'Save draft (Ctrl+S)');
  assert.equal(save.disabled, false, 'its assets known: it can be saved');
  save.click();
  await flush();
  const put = P.store.asks.find((a) => a.path === '/v1/poi/draft');
  assert.equal(put.method, 'PUT');
  assert.equal(put.body.doc.id, id); assert.equal(put.body.base, null);
  assert.equal(P.edit.entryOf(id).rev, 3); assert.equal(P.edit.entryOf(id).state, 'draft');
  assert.equal(P.edit.dirty(id), false);
  assert.ok(find(P.root, 'Saved: draft 3.').length === 1);
  button(P.root, 'Send for approval').click();
  await flush();
  assert.deepEqual(P.store.asks.at(-1), { path: '/v1/poi/submit', method: 'POST', body: { id, rev: 3 } });
  assert.equal(P.edit.entryOf(id).state, 'submitted');
  await flush();
  button(P.root, 'Take back to draft').click();
  await flush();
  assert.equal(P.edit.entryOf(id).state, 'draft');
  // a refusal: the store's word, said
  P.store.refuse = 'poi-not-builder';
  P.edit.edit(id, 'rename', (d) => { d.name = 'Camp 2'; });
  await flush(); await flush();
  button(P.root, 'Save draft (Ctrl+S)').click();
  await flush();
  const status = byClass(P.root, 'dfpoi-status')[0];
  assert.equal(status.dataset.kind, 'bad');
  assert.match(status.textContent, /builder/i);
  // the close asks again while it holds unsaved work
  await flush();
  button(P.root, 'Close').click();
  await flush();
  assert.equal(P.edit.has(id), true, 'asked first');
  button(P.root, 'Close without saving?').click();
  assert.equal(P.edit.has(id), false);
  // the facts: an asset the store has not got is not-uploaded once heard; an offline one is not said at all
  const facts = createAssetFacts(async (s) => { if (s === 'gone') throw new Error('poi asset gone: 404'); throw new Error('offline'); });
  assert.equal(facts.of('gone'), undefined); assert.equal(facts.of('down'), undefined);
  await flush();
  assert.equal(facts.of('gone'), null);
  assert.equal(facts.known('down'), false, 'offline: not known, asked again');
});

test('POI-3b OPENING FROM THE STORE: the list asked and searched; a POI opened as my own open draft when I have one, its live revision otherwise, with the base it was made from (mutants: another\'s draft opened as mine; the live revision\'s base lost)', async () => {
  const P = await panelOver({ handle: 'Mac' });
  const doc = (name, id = 'poi-00000000000a') => ({ v: 1, id, name, place: { px: 1, py: 1, x: 1, z: 1, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1 }, parts: [] });
  P.store.list = [{ id: 'poi-00000000000a', name: 'Tower', liveRev: 2 }, { id: 'poi-00000000000b', name: 'Bridge', liveRev: null }];
  button(P.root, 'Refresh the list').click();
  await flush();
  assert.ok(find(P.root, 'Tower').length === 1 && find(P.root, 'Bridge').length === 1);
  // AUDIT POI T7: each revision carries the base it was made from, and mine was made from revision 1 - with no base the
  // fixture's "the base it was made from" and "the live revision" were one number, and either passed
  P.store.history = { id: 'poi-00000000000a', liveRev: 2, revs: [
    // PIN MOVED (AUDIT POI P6, T7): every revision carries the store's `base` (poi.js history); my own draft was made
    // from revision 1 while revision 2 went live since - it opens with ITS base, never the live one's
    { rev: 2, kind: 'doc', doc: doc('Tower'), base: 1, author: 'Ann', state: 'approved' },
    { rev: 3, kind: 'doc', doc: doc('Tower (Ann)'), base: 2, author: 'Ann', state: 'draft' },
    { rev: 4, kind: 'doc', doc: doc('Tower (Mac)'), base: 1, author: 'mac', state: 'draft' },
  ] };
  find(P.root, 'Tower').find((n) => n.tagName === 'SPAN').parentNode.click();
  await flush();
  const e = P.edit.entryOf('poi-00000000000a');
  assert.equal(P.edit.docOf('poi-00000000000a').name, 'Tower (Mac)', 'my own draft, whatever the case of my name');
  assert.deepEqual([e.rev, e.state, e.base], [4, 'draft', 1], 'my draft with the base it was made from, not the live one');
  P.edit.close('poi-00000000000a');
  P.store.history.revs = P.store.history.revs.slice(0, 2);
  await P.panel.open('poi-00000000000a');
  assert.equal(P.edit.docOf('poi-00000000000a').name, 'Tower', 'none of mine: the live revision, never Ann\'s draft');
  assert.deepEqual([P.edit.entryOf('poi-00000000000a').state, P.edit.entryOf('poi-00000000000a').base], ['live', 2]);
});

test('POI-3b THE IMPORT: a model\'s parts held to the mesh law - one past a limit refused by its code; its pictures by their headers (one the store would refuse set aside, its materials plain); each picture and mesh uploaded once, by name; the materials\' images their pictures\' names; a refusal stops it at the part (mutants: a picture uploaded twice; a refused part uploaded)', async () => {
  const tooMany = quad(1);
  tooMany.submeshes = Array.from({ length: POI_MESH_LIMITS.submeshes + 1 }, () => ({ start: 0, count: 3 }));
  const model = {
    name: 'Shrine',
    materials: [{ base: { image: 0, wrap: ['repeat', 'clamp'], filter: 'nearest' } }, { base: { image: 1 } }],
    images: [{ name: 'stone', bytes: PNG }, { name: 'bad', bytes: new Uint8Array([1, 2, 3, 4]) }],
    warnings: [{ code: 'animation' }],
  };
  const baked = [
    { name: 'Base', position: [1, 0, 0], mesh: quad(2), materials: [0, 1] },
    { name: 'Roof', position: [0, 2, 0], mesh: quad(1), materials: [0] },
    { name: 'Spire', position: [0, 4, 0], mesh: tooMany, materials: [0] },
  ];
  const prep = prepareImport(model, baked);
  assert.deepEqual(prep.refused, [{ name: 'Spire', code: 'too-many-submeshes' }]);
  assert.deepEqual(prep.parts.map((p) => p.name), ['Base', 'Roof']);
  assert.ok(prep.warnings.some((w) => w.code === 'image-format' && w.image === 1), 'the picture the store would refuse, set aside');
  assert.equal(prep.parts[0].materials[1].texture, null, 'its material plain');
  assert.equal(prep.parts[0].materials[0].wrap[1], 'clamp');
  const puts = [];
  const r = await uploadImport(prep, async (bytes, kind) => { const sha = await sha256(bytes); puts.push(kind); return { ok: true, data: { sha, kind, meta: kind === 'mesh' ? { submeshes: 1 } : { w: 1, h: 1 } } }; });
  assert.equal(r.ok, true);
  assert.deepEqual(puts, ['texture', 'mesh', 'mesh'], 'the one picture once, each mesh once');
  const pngSha = await sha256(PNG);
  assert.equal(r.asset.name, 'Shrine');
  assert.deepEqual(r.asset.parts.map((p) => [p.name, p.t, p.materials[0].texture]), [['Base', [1, 0, 0], pngSha], ['Roof', [0, 2, 0], pngSha]]);
  assert.equal(r.asset.parts[0].mesh, await sha256(prep.parts[0].bytes));
  // PIN MOVED (AUDIT POI L9): the store's meta and the bytes put - the facts the budgets read
  assert.deepEqual(r.metas.get(pngSha), { kind: 'texture', w: 1, h: 1, bytes: PNG.byteLength });
  assert.equal(r.asset.parts[0].materials[0].color.length, DEFAULT_MATERIAL.color.length);
  let n = 0;
  const stop = await uploadImport(prep, async (bytes, kind) => (kind === 'mesh' && ++n === 2 ? { ok: false, error: 'poi-quota' } : { ok: true, data: { sha: await sha256(bytes), kind, meta: {} } }));
  assert.deepEqual(stop, { ok: false, error: 'poi-quota', part: 'Roof' });
});

test('POI-3b THE EDITOR IN THE WORLD, BY SOURCE: `?editor` alone, refused online with the other powers; the store asked who may build before anything is made; the motor held and the frame\'s eye the editor\'s while it is open; the drafts laid over the feed before the POI host reads it; the lines after the translucent pass, marked; no hand drawn; no blow on the body left standing; a draft\'s assets asked with the bearer (mutants: refused online no more; the motor stepped under the editor)', () => {
  const w = src('src/scenes/world.js');
  assert.ok(ONLINE_REFUSED_FLAGS.includes('editor'));
  assert.match(w, /if \(params\.has\('editor'\)\) startPoiEditor\(\);/);
  assert.match(w, /poiMe\(first\)\.then\(\(r\) => \{[\s\S]{0,300}if \(!r\.data\.builder\) \{ townTalk\.say\(accountRefusalText\('poi-not-builder'\)\); return; \}\s*mountPoiEditor\(r\.data, io\);/);
  assert.match(w, /const frameMotor = \(\) => \{[^\n]*\n\s*if \(poiEditor\?\.active\(\)\) poiEditor\.cameraFrame\(dt, cam\);[^\n]*\n\s*else if \(walkMode\) \{/);
  assert.match(w, /if \(poiEditor\?\.active\(\)\) mwv0\.eye = \[cam\.pos\[0\], cam\.pos\[1\], cam\.pos\[2\]\];/);
  assert.match(w, /try \{ poiEditor\?\.frame\(\); poiHost\?\.frame\(\); \}/);
  // PIN MOVED (AUDIT POI R4, R14): the translucent pass sorts by the view's own eye and stands after the grass and the haze;
  // the editor's lines moved with it, after it still
  const tr = w.indexOf('poiHost?.drawTranslucent(renderer, mwv.eye, yardCull);'), lines = w.indexOf('if (poiEditor?.drawLines(proj, view)) renderer.markForeignPass();');
  assert.ok(tr > 0 && lines > tr && lines - tr < 400, 'the lines after the translucent pass, the pass marked');
  assert.match(w, /if \(!poiEditor\?\.active\(\)\) \{ if \(walkMode && playerSpawned && !tvf\) weaponRig\.draw\(\{ paralyzed \}\); \}/);
  assert.match(w, /registerPlayerDamageMod\('poi-editor', \(_e, dmg\) => \(editor\.active\(\) \? 0 : dmg\)\);/);
  assert.match(w, /auth: \(\) => storedSession\(appStorage\(\)\)\?\.secret \?\? null,/);
  assert.match(w, /collideDrafts: \(\) => poiEditor\?\.collideDrafts\(\) \?\? true,/);
});
