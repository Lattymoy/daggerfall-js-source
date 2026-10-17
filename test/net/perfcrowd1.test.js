// PERF-CROWD (2026-10-10, Dudey: "the game has huge performance issues in almost all departments" and "big problems
// are caused by many players causing severe stutter") - bible/07-Rendering/Performance-Crowd.md. The pins (the pass's
// own PERF-V8 pin is not here: the world host's frame is PERF-PRIORITY's PERF-V8, pinned by test/scenes/perfv8.test.js):
//
//   INPUT1  the binding maps walked by forEach (no [key, value] pair a binding a poll), the same codeDown sequence
//   PEERS2  a peer's feet asked of toScene once a sync, however many layers read them; the names' proj x view once
//   NAMES1  a name moved by its transform (no box moved), each value written when it changes from what was written
//   LEAK1   a frame with nobody to label lets the last crowd's tags go; a covered frame keeps them
//   GC1     the desktop shell gives V8's young generation 32 MB semi-spaces, once, before the app is ready
//   SAILS1  a boat's walk makes a node's matrix again only where its own values, its parent's matrix or its parent moved -
//           every matrix the reference walk's (activeObjects) to the bit, through a turned spar, a moved hull, a part
//           switched off while its hull moved and back on, and a part hung under another
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RemotePlayers } from '../../src/net/remotePlayers.js';
import { createNameLayer, NAME_CSS } from '../../src/ui/nameLayer.js';
import { held, setBindings, bindings } from '../../src/ui/input.js';
import { projectToScreen } from '../../src/player/tapRay.js';
import { perspective, mirrorProjectionX, lookAt, multiply } from '../../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('PERF-INPUT1 (SUPERSEDED at the merge by main\'s AUDIT TECH-FX - an action\'s codes kept in an index rebuilt on a binding change, which walks no map a poll at all; its own pins hold the mechanism): a poll still answers as the walk did - a key bound in the secondary dict alone holds the action, the primary\'s too, another action\'s key and nothing held do not', () => {
  // behaviour: a key bound in the SECONDARY dict alone answers; an unbound one does not; a primary answers first
  const real = bindings();
  const b = { primary: new Map([['KeyW', 'MoveForwards']]), secondary: new Map([['ArrowUp', 'MoveForwards'], ['KeyQ', 'Jump']]), sharedPrimary: new Map(), sharedSecondary: new Map(), combos: real.combos ?? new Map() };
  setBindings({ ...real, ...b });
  try {
    assert.equal(held(new Set(['ArrowUp']), 'MoveForwards'), true, 'the secondary binding holds the action');
    assert.equal(held(new Set(['KeyW']), 'MoveForwards'), true, 'the primary binding holds the action');
    assert.equal(held(new Set(['KeyQ']), 'MoveForwards'), false, 'another action\'s key does not');
    assert.equal(held(new Set(), 'MoveForwards'), false, 'nothing held, nothing down');
  } finally { setBindings(real); }
});

test('PERF-PEERS2: a peer\'s feet are asked of toScene ONCE a sync, however many layers read them (the steps, the swing, the hooves, the doll) - and the names\' proj x view is the same float32 product handed in as made per head (mutants: the memo left set across peers; the memo not cleared at the sync\'s end)', async () => {
  const asked = new Map();
  const toScene = (p) => { asked.set(p.who, (asked.get(p.who) ?? 0) + 1); return [p.x, p.y, p.z]; };
  const played = [];
  const audio = { playOneShot: () => {}, play3d: (clip, at) => played.push(at), setLoop3d: () => {} };
  const renderer = { createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch: () => {}, uploadTexture: () => ({}), textures: new Map(), releaseTexture: () => {} };
  const rp = new RemotePlayers({ renderer, deps: { fetchBytes() {}, palette: null, getTexture: async () => null, audio }, compose: async () => null });
  const peer = (id, x) => ({ id, look: null, shown: { who: id, x, y: 0, z: -5, yaw: 0, pitch: 0, mv: 1, an: 0, fk: 0, rd: 1 } });
  const a = peer('a', 1), b = peer('b', 2);
  rp.sync([a, b], toScene, { dt: 0.016, eye: [0, 1.7, 0] });
  b.shown.an = 1;   // a swing - the swing layer reads the feet too
  rp.sync([a, b], toScene, { dt: 0.016, eye: [0, 1.7, 0] });
  assert.deepEqual([...asked.entries()], [['a', 2], ['b', 2]], 'each peer\'s feet once a sync, over two syncs');
  assert.equal(rp._fFor, null, 'no feet outlive the sync that asked for them');
  a.shown.x = 9;
  rp.sync([a], toScene, { dt: 0.016, eye: [0, 1.7, 0] });
  assert.equal(rp._feet(a, toScene)[0], 9, 'a moved peer is read anew the next sync');
  // the projection: the product handed in is the product made per head
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 600)), view = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
  for (const p of [[1, 2, -9], [-3, 0.5, -20], [0.2, 1.7, 30]]) assert.deepEqual(projectToScreen(p, 1600, 900, proj, view, null, false, multiply(proj, view)), projectToScreen(p, 1600, 900, proj, view));
  assert.match(rd('src/net/remotePlayers.js'), /projectToScreen\(head, w, h, proj, view, rect, false, pv \?\?= multiply\(proj, view\)\)/, 'namePoints makes it once');
});

/** A fake document (test/net/name1_bubbles.test.js's shape): every write counted. */
function fakeDocument() {
  const doc = { writes: 0, built: 0 };
  const node = (tag) => {
    const n = { tagName: tag, children: [], parent: null, attrs: {}, removed: false,
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
      setAttribute(k, v) { n.attrs[k] = v; },
      remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; n.removed = true; } };
    let text = '', cls = '';
    Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); doc.writes++; } });
    Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); doc.writes++; } });
    n.style = new Proxy({}, { set(t, k, v) { t[k] = v; doc.writes++; return true; } });
    return n;
  };
  doc.createElement = (t) => { doc.built++; return node(t); };
  doc.head = node('head'); doc.body = node('body');
  doc.getElementById = () => null;
  return doc;
}

test('PERF-NAMES1 + PERF-LEAK1: a name is moved by its transform alone (no box moved, nothing laid out), a still frame writes nothing, the sheet keeps no will-change (a layer of its own rasters the text apart); and a frame with nobody to label lets the tags go, a covered one keeps them (mutants: left/top written; the sweep skipped on an empty frame; a covered frame swept)', () => {
  assert.match(NAME_CSS, /\.dfname \{[^}]*transform: translate\(-50%, -100%\); contain: layout style; \}/);
  assert.doesNotMatch(NAME_CSS.replace(/\/\*[\s\S]*?\*\//g, ''), /will-change/, 'no layer of its own - the pixels are the page\'s (measured: 324 differ with one)');
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  const pts = (x) => [{ id: 'a', name: 'Ann', x, y: 300, scale: 1, lv: 7 }, { id: 'b', name: 'Bo', x: 500, y: 200, scale: 0.8 }];
  layer.render({ points: pts(100) });
  const a = layer.tagFor('a');
  assert.equal(a.node.style.left, undefined); assert.equal(a.node.style.top, undefined);
  assert.match(a.node.style.transform, /^translate\(100px, \d+px\) translate\(-50%, -100%\)$/);
  doc.writes = 0;
  layer.render({ points: pts(100) });
  assert.equal(doc.writes, 0, 'a frame where nothing changed writes nothing');
  layer.render({ points: pts(140) });
  assert.equal(doc.writes, 1, 'a move is ONE write - the transform');
  assert.equal(doc.built > 0, true);
  const builtBefore = doc.built;
  layer.render({ points: pts(140), covered: true });
  assert.equal(layer.tagCount(), 2, 'a window over the HUD keeps the names, to be moved again when it closes');
  layer.render({ points: pts(140) });
  assert.equal(doc.built, builtBefore, '...and nothing is rebuilt');
  layer.render({ points: [] });
  assert.equal(layer.tagCount(), 0, 'nobody to label: the last crowd\'s tags are let go');
  assert.equal(a.node.removed, true, '...out of the page, not only hidden');
  layer.destroy();
});

test('PERF-PEERS4: a class sprite\'s archive is warmed once the sprite has STOOD as its peer WARM_AFTER_FRAMES frames - never on its bundle\'s landing, so a peer drawn in a set or a body (the bundle a stand-in) warms nothing (mutants: the warm back on landing; the count never reached)', async () => {
  const { WARM_AFTER_FRAMES } = await import('../../src/net/remotePlayers.js');
  const src = rd('src/net/remotePlayers.js');
  assert.doesNotMatch(src, /this\._mobiles\.set\(peerId, bundle\); this\._warmArchive\(bundle\);/, 'no warm on landing');
  assert.match(src, /if \(\+\+entry\.drawnFrames === WARM_AFTER_FRAMES\) this\._warmArchive\(bundle\);/);
  assert.equal(WARM_AFTER_FRAMES, 30);
  // executed: a bundle that lands warms nothing; one drawn WARM_AFTER_FRAMES frames warms once
  const renderer = { createBillboardBatch: () => ({ origin: [0, 0, 0], size: null }), destroyBillboardBatch: () => {}, uploadTexture: () => ({}), textures: new Map(), releaseTexture: () => {} };
  const tex = { recordCount: 8, getFrameCount: () => 4, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getOffset: () => ({ x: 0, y: 0 }) };
  const rp = new RemotePlayers({ renderer, deps: { fetchBytes() {}, palette: null, getTexture: async () => tex, uploadRecordFrame: () => {} }, compose: async () => null });
  const warmed = [];
  rp._warmArchive = (b) => warmed.push(b.archive);
  const peer = { id: 'p', look: { race: 'Nord', gender: 'male', faceIndex: 0, class: 'Warrior', items: [] }, shown: { x: 0, y: 0, z: -5, yaw: 0, pitch: 0, mv: 0, an: 0 } };
  rp.sync([peer], (p) => [p.x, p.y, p.z], { dt: 0.016, eye: [0, 1.7, 0] });
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(warmed, [], 'the bundle landed: nothing warmed');
  for (let f = 0; f < WARM_AFTER_FRAMES - 1; f++) rp.sync([peer], (p) => [p.x, p.y, p.z], { dt: 0.016, eye: [0, 1.7, 0] });
  assert.deepEqual(warmed, [], 'not before it has stood its frames');
  rp.sync([peer], (p) => [p.x, p.y, p.z], { dt: 0.016, eye: [0, 1.7, 0] });
  for (let f = 0; f < 5; f++) rp.sync([peer], (p) => [p.x, p.y, p.z], { dt: 0.016, eye: [0, 1.7, 0] });
  assert.equal(warmed.length, 1, 'then once');
});

test('PERF-GC1: the desktop shell sets the young generation\'s semi-space to 32 MB - ONE js-flags switch (a second would replace it), after the storage root is pinned and before the app is ready, where Chromium reads its switches (mutants: the switch dropped; set after ready)', () => {
  const main = readFileSync(new URL('../../app/main.cjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const from = main.indexOf("\nif (process.env.DAGGER_USER_DATA) app.setPath('userData'"), to = main.indexOf('\napp.whenReady()');
  assert.ok(from > 0 && to > from, 'the storage root is pinned, then the app is readied');
  const flags = [...main.matchAll(/appendSwitch\('js-flags'/g)];
  assert.equal(flags.length, 1, 'one js-flags switch in the shell');
  assert.match(main.slice(from, to), /\napp\.commandLine\.appendSwitch\('js-flags', '--max-semi-space-size=32'\);/);
});

test('PERF-SAILS1: a boat\'s walk makes a node\'s matrix only where it moved - and every matrix is the reference walk\'s to the bit through a turned spar, a moved hull, a part switched off while the hull moved and on again, and a part hung elsewhere (mutants: the parent\'s making not asked; the local values not asked; the parent not asked)', async () => {
  const { createComeSailAwayPool, activeObjects } = await import('../../src/scenes/comeSailAway/comeSailAwayPool.js');
  const { Boat } = await import('../../src/systems/comeSailAway/comeSailAwayBoat.js');
  const { fileURLToPath } = await import('node:url');
  const fileFetch = async (url) => { const bytes = readFileSync(fileURLToPath(url)); return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) }; };
  const renderer = { createMesh: (m) => ({ model: m, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: m.subMeshes.map((x) => ({ ...x, _bounds: [0, 0, 0, 0] })) }), drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (a, r, size) => ({ a, r, size }), destroyBillboardBatch() {}, destroyMesh() {} };
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const pipeline = { textureFiles: new Map(), cpuModels: new Map(), gpuMeshes: new Map(), getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };
  const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  const boat = pool.spawnNow(new Boat(3, 0), { position: [5, 0, 5], rotation: [0, Math.sin(0.3), 0, Math.cos(0.3)] });
  const step = () => pool.frame(0, { playerPosition: [0, 0, 0], cityLightsOn: true });
  const same = (why) => {
    step();
    const w = pool.walkOf(boat), ref = [...activeObjects(boat.GameObject)];
    assert.equal(w.nodes.length, ref.length, `${why}: every active object`);
    ref.forEach(([n, m], i) => {
      assert.equal(w.nodes[i], n, `${why}: the order`);
      assert.ok(m.every((v, k) => Object.is(v, w.mats[i][k])), `${why}: ${n.name}'s matrix to the bit`);
    });
  };
  same('built');
  same('still');
  const deep = [...activeObjects(boat.GameObject)].map(([n]) => n).find((n) => n.parent && n.parent.parent && n.children.length);
  assert.ok(deep, 'a part with a parent above it and parts under it');
  deep.localRotation[1] += 0.2; deep.localRotation[3] = Math.sqrt(Math.max(0, 1 - deep.localRotation[1] ** 2));   // turned in place
  same('a spar turned in place');
  boat.GameObject.localPosition[0] += 3.5;
  same('the hull moved');
  const kid = deep.children.find((c) => c.activeSelf);
  kid.activeSelf = false; same('a part switched off');
  boat.GameObject.localPosition[2] -= 7; same('the hull moved while it was off');
  kid.activeSelf = true; same('the part on again, where its hull now stands');
  const elsewhere = [...activeObjects(boat.GameObject)].map(([n]) => n).find((n) => n !== deep && n.parent && !deep.children.includes(n) && n.children.length === 0 && n.parent !== boat.GameObject);
  elsewhere.setParent(boat.GameObject);
  same('a part hung under the hull itself');
  // and under another part made as often as its old parent was - a parent's making is named once, whoever made it
  const under = (n, a) => { for (let x = n; x; x = x.parent) if (x === a) return true; return false; };
  const parts = [...activeObjects(boat.GameObject)].map(([n]) => n).filter((n) => n !== boat.GameObject && !under(n, deep));
  // a sibling of its parent: made exactly as often as the parent was, so only a making's own name tells them apart
  const sibOf = (n) => n.parent?.children.find((c) => c !== n && c.activeSelf && parts.includes(c));
  const leaf = parts.find((n) => n.children.length === 0 && n.parent !== boat.GameObject && sibOf(n.parent));
  const host = sibOf(leaf.parent);
  leaf.setParent(host);
  same('a part hung under another part');
});
