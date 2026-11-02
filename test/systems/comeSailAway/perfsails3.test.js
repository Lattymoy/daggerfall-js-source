// PERF-SAILS3 (2026-10-14, a live capture of the owner's client in a port, online - the boats' frame 1.8 ms of a 10 ms
// frame and 1.5 MB a frame of its garbage; bible/07-Rendering/Performance-Crowd.md PERF-SAILS3) - A BOAT'S PLAN: what
// of her walk the frame, the flats and the draw read is found once and kept while her walk's nodes and the trees' shape
// stand, the walk written where it stood, the flats' sizes and scales and the ropes' bones and poses in records of their
// own - and everything the pool draws, bakes and stands is what it was before, to the bit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createComeSailAwayPool, activeObjects } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { isDfMaterial } from '../../../src/systems/comeSailAway/comeSailAwayModels.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';
import { PrefabNode } from '../../../src/world/prefabNode.js';
import { readyPool } from '../../navalSea.mjs';

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
const standInPipeline = () => ({ textureFiles: { get: () => texture() }, cpuModels: new Map(), gpuMeshes: new Map(), getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) });
const nodesOf = (b) => [...b.GameObject.walk()];
const bits = (arr) => { const f = new Float64Array(arr.length); for (let i = 0; i < arr.length; i++) f[i] = arr[i]; return Buffer.from(f.buffer).toString('base64'); };

/** A recording renderer: every call the pool makes of it, in order, into `put` - each mesh and batch named by the order
 *  it was made in, each matrix by its bits; and a camera, so the draw's cull and its shadow records run. */
function recorder(put) {
  let meshN = 0, batchN = 0;
  const ids = new WeakMap();
  const idOf = (o) => (o ? (ids.get(o) ?? '?') : 'null');
  const r = {
    createMesh: (m) => { const g = { model: m, buffers: [{}, {}], bounds: [0, 0, 0, 1], subMeshes: m.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }; ids.set(g, `m${meshN++}:${m.positions?.length ?? 0}`); put(`create ${ids.get(g)}|`); return g; },
    drawMesh(gpu, m, tex) { put(`d ${idOf(gpu)} ${bits(m)} ${tex ? 't' : ''}|`); },
    updateMeshVertices(g, p) { put(`u ${idOf(g)} ${bits(p.subarray(0, Math.min(p.length, 600)))} ${p.length}|`); },
    createBillboardBatch: (a, rec, size, c) => { const b = { a, rec, size: { ...size }, c }; ids.set(b, `b${batchN++}`); put(`cb ${ids.get(b)} ${a} ${rec} ${size.w} ${size.h}|`); return b; },
    destroyBillboardBatch(b) { put(`xb ${idOf(b)}|`); }, destroyMesh(g) { put(`xm ${idOf(g)}|`); },
    setDissolve(f) { put(`dis ${f}|`); },
    shadowReach: () => true, recordShadowMesh(g, m) { put(`s ${idOf(g)} ${bits(m)}|`); },
    _proj: new Float32Array([1, 0, 0, 0, 0, 1.7, 0, 0, 0, 0, -1.0002, -1, 0, 0, -0.2, 0]),
    _view: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, -5, -180, 1]),
    _camPos: [180, 5, -40], gl: { drawingBufferHeight: 900 },
  };
  return { r, idOf, counts: () => ({ meshN, batchN }) };
}

test('PERF-SAILS3: everything the pool draws, records for the shadows, bakes and stands as a flat is what it was before the plan, to the bit - twelve ships standing and rocking, a part switched off and on, a renderer off and on, a variant, a ship faded and one removed, the origin moved, a flat scaled, a part turned, the lights put out', async () => {
  const h = createHash('sha256');
  const put = (s) => h.update(s);
  const { r, idOf, counts } = recorder(put);
  const pool = createComeSailAwayPool({ renderer: r, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  await pool.preload();
  for (let i = 0; i < 12; i++) { const b = pool.spawnSeaNow(new Boat(i % 5, 0)); b.GameObject.localPosition = [i * 30, 0, 0]; }
  const mine = await pool.spawnNow(new Boat(2, 0), { position: [10, 0, 40], rotation: [0, 0, 0, 1] });
  const world = { cityLightsOn: true, playerPosition: [100, 0, 0] };
  const part = (b, k) => nodesOf(b).filter((x) => x.getComponent('MeshRenderer'))[k];
  for (let f = 0; f < 400; f++) {
    if (f === 90) { part(pool.seaBoats[1], 5).setActive(false); put('ev off|'); }
    if (f === 130) { part(pool.seaBoats[1], 5).setActive(true); put('ev on|'); }
    if (f === 150) { part(pool.seaBoats[2], 3).getComponent('MeshRenderer').m_Enabled = false; put('ev rend off|'); }
    if (f === 180) { part(pool.seaBoats[2], 3).getComponent('MeshRenderer').m_Enabled = true; put('ev rend on|'); }
    if (f === 200) { pool.setVariant(mine, 1); put('ev variant|'); }
    if (f === 220) { pool.seaBoats[3].fade = 0.4; put('ev fade|'); }
    if (f === 260) { pool.seaBoats[3].fade = 1; pool.remove(pool.seaBoats[4]); put('ev remove|'); }
    if (f === 280) { pool.offsetAll([5, 0, -3]); put('ev offset|'); }
    if (f === 300) { nodesOf(pool.seaBoats[0]).find((n) => n.getComponent('DaggerfallBillboard')).localScale = [1.5, 1.5, 1.5]; put('ev flat scale|'); }
    if (f === 320) { const s = pool.seaBoats[5]; (nodesOf(s).find((n) => n.name === 'FlagObject') ?? nodesOf(s)[7]).localRotation = [0, Math.sin(0.3), 0, Math.cos(0.3)]; put('ev turn|'); }
    if (f === 340) { world.cityLightsOn = false; put('ev lights|'); }
    if (f > 60) for (const b of pool.seaBoats) if (b.MeshObject) { const a = Math.sin(f * 0.05) * 0.02, c = Math.cos(f * 0.07) * 0.03; b.MeshObject.localRotation = [Math.sin(a / 2), 0, Math.sin(c / 2), Math.cos(a / 2) * Math.cos(c / 2)]; }
    pool.frame(f % 7 === 0 ? 0 : 1 / 60, world);
    pool.draw(r, f % 3 === 0 ? null : {});
    for (const b of pool.batches()) put(`f ${idOf(b)} ${bits(b.origin)} ${b.size.w} ${b.size.h} ${b.emissionOff} ${b.conceal}|`);
    for (const l of pool.lights([100, 2, 0])) put(`l ${bits([l.x, l.y, l.z, l.range, ...l.color])}|`);
    put(`F${f}|`);
    if (f % 25 === 0) await new Promise((res) => setTimeout(res, 5));   // the bakes' and the meshes' uploads land
  }
  assert.deepEqual(counts(), { meshN: 359, batchN: 224 }, 'the meshes and the flats made');
  // the same run on the pool before PERF-SAILS3 (origin/main 395099cec, DF-ART III's ships in it; 6fb2ddd4... on d8ccf7fd6, before DF-ART, the same both sides then too)
  assert.equal(h.digest('hex'), '1912a297284d9343285654e909fc5ef3fd3e241a612bb2adf9492b74eadf2cfe');
});

test('PERF-SAILS3: a boat\'s walk is written where it stood and her plan is kept while her nodes are the same - made again when a part is switched off, on again, or a component is added, and the draw follows each (mutants: the plan kept past a walk of other nodes; past a component added; the walk\'s lists emptied every frame)', async () => {
  const drawn = [], made = [];
  const r = { createMesh: (m) => { made.push(m); return { model: m, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: m.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }; }, drawMesh: (g, m) => drawn.push(m), updateMeshVertices() {}, createBillboardBatch: (a, rec, size) => ({ a, rec, size }), destroyBillboardBatch() {}, destroyMesh() {} };
  const pool = createComeSailAwayPool({ renderer: r, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  await pool.preload();
  const boat = pool.spawnSeaNow(new Boat(HULL.SmallShip, 0));
  const frame = async () => { drawn.length = 0; pool.frame(1 / 60); pool.draw(); await new Promise((res) => setTimeout(res, 1)); };
  for (let i = 0; i < 40; i++) await frame();
  const w = pool.walkOf(boat), nodes = w.nodes, plan = w.plan;
  assert.ok(plan && plan.parts.length > 10, 'her plan, her renderers in it');
  await frame();
  assert.equal(w.nodes, nodes, 'the same list, written over');
  assert.equal(pool.walkOf(boat).plan, plan, 'the same plan, a frame on');
  // a part of hers drawn on its own (a rope or a flag), switched off: the walk is of other nodes, the plan made again
  const own = plan.parts.find((e) => e.node !== boat.MeshObject && drawn.includes(w.mats[e.i]));
  assert.ok(own, 'a part drawn at its own matrix');
  const at = () => drawn.includes(pool.walkOf(boat).mats[pool.walkOf(boat).nodes.indexOf(own.node)]);
  own.node.setActive(false);
  await frame();
  assert.notEqual(pool.walkOf(boat).plan, plan, 'another plan');
  assert.equal(pool.walkOf(boat).nodes.includes(own.node), false, 'out of her walk');
  const active = [...activeObjects(boat.GameObject)].map(([n]) => n);
  assert.deepEqual(pool.walkOf(boat).nodes, active, 'her walk is her active objects, no more - the shorter walk\'s tail gone');
  assert.equal(pool.walkOf(boat).recs.length, active.length, 'and its records with it');
  assert.equal(at(), false, 'not drawn');
  own.node.setActive(true);
  await frame();
  assert.equal(at(), true, 'drawn again');
  // a node of hers given a billboard (its components added - the same nodes walked): the plan made again, its flat in it
  const kept = pool.walkOf(boat).plan;
  const bare = pool.walkOf(boat).nodes.find((n) => n !== boat.GameObject && !n.components.length);
  assert.ok(bare, 'a node of hers that carries nothing');
  bare.addComponent({ type: 'DaggerfallBillboard', Summary: { Size: [1, 2], Archive: 210, Record: 0 } });
  bare.addComponent({ type: 'MeshRenderer', m_Enabled: true, materials: [{ billboard: true }] });
  await frame();
  assert.notEqual(pool.walkOf(boat).plan, kept, 'made again');
  assert.ok(pool.walkOf(boat).plan.flats.some((e) => e.node === bare), 'the new flat in it');
  assert.ok(pool.batches().some((b) => b.a === 210), 'and stood');
  // a renderer handed other materials (a new array, as every writer hands one): its model asked again by its new key
  const dressed = pool.walkOf(boat).plan.parts.find((e) => !e.mf?.baked && e.mf?.m_Mesh?.mesh && e.mr.materials?.some(isDfMaterial) && drawn.length);
  assert.ok(dressed, 'a part of hers dressed in Daggerfall\'s textures');
  const before = made.length;
  dressed.mr.materials = dressed.mr.materials.map((s) => (isDfMaterial(s) ? { archive: s.archive, record: (s.record + 7) % 100 } : s));
  await frame(); await frame();
  const recs = made.slice(before).flatMap((m) => m.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`));
  const want = dressed.mr.materials.filter(isDfMaterial).map((s) => `${s.archive}_${s.record}`);
  assert.ok(want.some((k) => recs.includes(k)), `its model made again in its new textures (${want.slice(0, 3)})`);
});

test('PERF-SAILS3: a flat\'s batch goes the frame its node leaves the walk, and its size is the one record the pool gave it, written each frame with the scale it stands at now (mutants: the sweep keeps an unmarked batch; the size kept as it was)', async () => {
  const gone = [];
  const r = { createMesh: (m) => ({ model: m, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: m.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }), drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (a, rec, size) => ({ a, rec, size }), destroyBillboardBatch: (b) => gone.push(b), destroyMesh() {} };
  const pool = createComeSailAwayPool({ renderer: r, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  await pool.preload();
  const boat = pool.spawnSeaNow(new Boat(HULL.SmallShip, 0));
  for (let i = 0; i < 3; i++) pool.frame(1 / 60);
  const plan = pool.walkOf(boat).plan;
  const flat = plan.flats.find((e) => e.r && e.r.m_Enabled !== false && e.bb.Summary.Size[0] > 0 && !e.node.children.length);
  assert.ok(flat, 'a flat of hers');
  const before = new Map(pool.batches().map((b) => [b, [b.size, b.size.h]]));
  flat.node.localScale = [2, 2, 2];
  pool.frame(1 / 60);
  const grew = pool.batches().filter((b) => b.size.h !== before.get(b)[1]);
  assert.equal(grew.length, 1, 'one flat stands at another size');
  const batch = grew[0], [size, h0] = before.get(batch);
  assert.equal(batch.size, size, 'the same record');
  assert.ok(Math.abs(size.h - 2 * h0) < 1e-6 * h0, `its height at the scale it stands at now (${h0} -> ${size.h})`);
  flat.node.setActive(false);
  pool.frame(1 / 60);
  assert.ok(gone.includes(batch), 'destroyed the frame its node left');
  assert.equal(pool.batches().includes(batch), false, 'and no longer stood');
});

test('PERF-SAILS3: lossyScaleOf into a kept array is the allocating answer to the bit - every node of every hull, and five hundred random turns and scales under turned and scaled parents (mutant: a term of the diagonal another\'s)', async () => {
  const pool = await readyPool();
  pool.destroyAll();
  const out = [0, 0, 0];
  let n = 0;
  for (let hull = 0; hull < 5; hull++) {
    const b = pool.spawnSeaNow(new Boat(hull, 0));
    for (const node of nodesOf(b)) { const m = node.worldMatrix(); assert.deepEqual([...node.lossyScaleOf(m, out)], node.lossyScaleOf(m), node.name); n++; }
    pool.remove(b);
  }
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  const quat = () => { const q = [rnd(), rnd(), rnd(), rnd()], l = Math.hypot(...q); return q.map((v) => v / l); };
  for (let i = 0; i < 500; i++) {
    const root = new PrefabNode('r', { rotation: quat(), scale: [1 + rnd(), 1 + rnd(), 1 + rnd()], position: [rnd() * 9, rnd() * 9, rnd() * 9] });
    const mid = new PrefabNode('m', { rotation: quat(), scale: [1 + rnd(), 0.5 + rnd(), 1 + rnd()] }).setParent(root);
    const leaf = new PrefabNode('l', { rotation: quat(), scale: [2 + rnd(), 1 + rnd(), 0.7 + rnd()] }).setParent(mid);
    const m = leaf.worldMatrix();
    const got = leaf.lossyScaleOf(m, out), want = leaf.lossyScaleOf(m);
    assert.ok(want.every((v, k) => Object.is(v, got[k])), `random ${i}: ${want} vs ${got}`);
    n++;
  }
  assert.ok(n > 2000, `${n} nodes`);
});

test('PERF-SAILS3: an every-frame rope finds its bones once, and again when its renderer\'s bones are another list - a rope standing still bakes nothing, and one handed its bones in another order bakes the next frame (mutant: the bones kept past another list)', async () => {
  const pool = await readyPool();
  pool.destroyAll();
  const boat = pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const fixOf = (n) => n.children.map((c) => c.getComponent('FixDeformations')).find(Boolean) ?? null;
  const ropes = nodesOf(boat).filter((n) => /Line$/.test(n.name) && n.getComponent('SkinnedMeshRenderer')).map((n) => ({ n, smr: n.getComponent('SkinnedMeshRenderer'), fix: fixOf(n) }));
  assert.equal(ropes.length, 11, 'her running rope');
  for (let i = 0; i < 30; i++) pool.frame(1 / 60);
  const bakedOn = () => { for (const r of ropes) if (r.fix.bakedMesh) r.fix.bakedMesh.positions[0] = NaN; pool.frame(1 / 60); return ropes.filter((r) => r.fix.bakedMesh && !Number.isNaN(r.fix.bakedMesh.positions[0])); };
  assert.deepEqual(bakedOn(), [], 'standing, none bakes');
  const rope = ropes.find((r) => r.smr.m_Bones.length >= 2 && r.fix.bakedMesh);
  rope.smr.m_Bones = [...rope.smr.m_Bones].reverse();
  assert.deepEqual(bakedOn(), [rope], 'the rope handed its bones in another order bakes');
  assert.deepEqual(bakedOn(), [], 'and stands again');
});
